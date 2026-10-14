-- Platform view and audit log.
--
-- 1. audit_log: an append-only record of important actions in each gym
--    (payments, memberships, people and roles, the permission grid, plans,
--    gym settings), written by triggers. Owners read their gym's log; platform
--    admins (the developers, profiles.is_platform_admin) read every gym's.
-- 2. platform_* functions: what the developers' view (/platform in the web app)
--    shows. Only platform admins may call them, and looking at a gym's details
--    is itself logged, so the owner can see when support looked.

-- Audit log --------------------------------------------------------------------

create table public.audit_log (
  id bigint generated always as identity primary key,
  -- null for platform-wide entries (e.g. a support search)
  gym_id uuid references public.gyms (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  -- the actor was a platform admin (shown to owners as "Support")
  actor_platform boolean not null default false,
  action text not null,
  target_id uuid,
  -- names and amounts as they were at the time, for display
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index audit_log_gym_idx on public.audit_log (gym_id, id desc);
create index audit_log_id_idx on public.audit_log (id desc);

alter table public.audit_log enable row level security;

create policy "audit_log_select" on public.audit_log for select using (
  public.is_platform_admin() or (gym_id is not null and public.auth_role_in(gym_id) = 'owner')
);
-- No insert/update/delete policies or grants: only the functions below write.
revoke insert, update, delete on public.audit_log from authenticated, anon;

create function public.audit(p_gym_id uuid, p_action text, p_target_id uuid, p_details jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Rows of a gym that is being deleted for good go with it; nothing to log.
  if p_gym_id is not null and not exists (select 1 from public.gyms where id = p_gym_id) then
    return;
  end if;
  insert into public.audit_log (gym_id, actor_id, actor_platform, action, target_id, details)
  values (
    p_gym_id,
    -- not when the actor's own account is being deleted in this same statement
    (select id from public.profiles where id = auth.uid()),
    public.is_platform_admin(), p_action, p_target_id, coalesce(p_details, '{}'));
end;
$$;

revoke execute on function public.audit(uuid, text, uuid, jsonb) from public, anon, authenticated;

-- A member's display name, for log entries.
create function public.audit_member_name(p_member_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(p.full_name, ''), 'Someone')
  from public.gym_members gm join public.profiles p on p.id = gm.user_id
  where gm.id = p_member_id
$$;

revoke execute on function public.audit_member_name(uuid) from public, anon, authenticated;

-- Payments: recorded at the desk, claimed by UPI, confirmed, rejected, refunded, deleted.
create function public.audit_payments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.payments := case when tg_op = 'DELETE' then old else new end;
  v_details jsonb := jsonb_build_object(
    'member', public.audit_member_name(v_row.member_id),
    'amount_paise', v_row.amount_paise,
    'method', v_row.method,
    'receipt_no', v_row.receipt_no
  );
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_action := case when new.status = 'paid' then 'payment.recorded' when new.status = 'created' then 'payment.upi_claimed' end;
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    v_action := case
      when old.status = 'created' and new.status = 'paid' then 'payment.upi_confirmed'
      when old.status = 'created' and new.status = 'failed' then 'payment.upi_rejected'
      when new.status = 'refunded' then 'payment.refunded'
      else 'payment.status_changed'
    end;
    v_details := v_details || jsonb_build_object('from', old.status, 'to', new.status);
  elsif tg_op = 'UPDATE' and new.amount_paise is distinct from old.amount_paise then
    v_action := 'payment.amount_changed';
    v_details := v_details || jsonb_build_object('from_paise', old.amount_paise);
  elsif tg_op = 'DELETE' then
    v_action := 'payment.deleted';
  end if;
  if v_action is not null then
    perform public.audit(v_row.gym_id, v_action, v_row.id, v_details);
  end if;
  return null;
end;
$$;

create trigger audit_payments after insert or update or delete on public.payments
  for each row execute function public.audit_payments();

-- Memberships: cancelled or deleted (new ones are logged through their payment).
create function public.audit_subscriptions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.subscriptions := case when tg_op = 'DELETE' then old else new end;
  v_details jsonb := jsonb_build_object(
    'member', public.audit_member_name(v_row.member_id),
    'plan', v_row.plan_name,
    'ends_on', v_row.ends_on
  );
begin
  if tg_op = 'UPDATE' and new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    perform public.audit(new.gym_id, 'membership.cancelled', new.id, v_details);
  elsif tg_op = 'DELETE' then
    perform public.audit(old.gym_id, 'membership.deleted', old.id, v_details);
  end if;
  return null;
end;
$$;

create trigger audit_subscriptions after update or delete on public.subscriptions
  for each row execute function public.audit_subscriptions();

-- People: joined, approved/deactivated, roles changed, removed.
create function public.audit_gym_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.gym_members := case when tg_op = 'DELETE' then old else new end;
  v_name text := coalesce((select nullif(full_name, '') from public.profiles where id = v_row.user_id), 'Someone');
begin
  if tg_op = 'INSERT' then
    perform public.audit(new.gym_id, 'member.joined', new.id,
      jsonb_build_object('member', v_name, 'role', new.role, 'status', new.status));
  elsif tg_op = 'UPDATE' then
    if new.role is distinct from old.role or new.extra_roles is distinct from old.extra_roles then
      perform public.audit(new.gym_id, 'member.roles_changed', new.id, jsonb_build_object(
        'member', v_name,
        'from', array[old.role] || old.extra_roles,
        'to', array[new.role] || new.extra_roles));
    end if;
    if new.status is distinct from old.status then
      perform public.audit(new.gym_id, 'member.status_changed', new.id,
        jsonb_build_object('member', v_name, 'from', old.status, 'to', new.status));
    end if;
  elsif tg_op = 'DELETE' then
    perform public.audit(old.gym_id, 'member.removed', old.id, jsonb_build_object('member', v_name, 'role', old.role));
  end if;
  return null;
end;
$$;

create trigger audit_gym_members after insert or update or delete on public.gym_members
  for each row execute function public.audit_gym_members();

-- The owner's permission grid. A deleted row means "back to the default".
create function public.audit_role_permissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.gym_role_permissions := case when tg_op = 'DELETE' then old else new end;
begin
  if tg_op = 'UPDATE' and new.allowed is not distinct from old.allowed then
    return null;
  end if;
  perform public.audit(v_row.gym_id, 'permissions.changed', null, jsonb_build_object(
    'role', v_row.role,
    'permission', v_row.permission,
    'allowed', case when tg_op = 'DELETE' then public.default_permission(old.role, old.permission) else new.allowed end,
    'default', tg_op = 'DELETE'));
  return null;
end;
$$;

create trigger audit_role_permissions after insert or update or delete on public.gym_role_permissions
  for each row execute function public.audit_role_permissions();

-- Membership plans and prices.
create function public.audit_plans()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.plans := case when tg_op = 'DELETE' then old else new end;
  v_details jsonb := jsonb_build_object('plan', v_row.name, 'price_paise', v_row.price_paise);
begin
  if tg_op = 'INSERT' then
    perform public.audit(new.gym_id, 'plan.created', new.id, v_details);
  elsif tg_op = 'UPDATE' then
    if new.price_paise is distinct from old.price_paise or new.name is distinct from old.name
       or new.duration_days is distinct from old.duration_days or new.is_active is distinct from old.is_active then
      perform public.audit(new.gym_id, 'plan.updated', new.id, v_details || jsonb_build_object(
        'from_price_paise', old.price_paise, 'from_name', old.name, 'active', new.is_active));
    end if;
  else
    perform public.audit(old.gym_id, 'plan.deleted', old.id, v_details);
  end if;
  return null;
end;
$$;

create trigger audit_plans after insert or update or delete on public.plans
  for each row execute function public.audit_plans();

-- The gym itself: registered, settings changed, deleted/restored, suspended.
create function public.audit_gyms()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Counters the database bumps on its own: not worth an entry.
  v_ignore text[] := array['receipt_seq'];
  v_changed text[];
begin
  if tg_op = 'INSERT' then
    perform public.audit(new.id, 'gym.registered', new.id, jsonb_build_object('gym', new.name, 'slug', new.slug));
    return null;
  end if;

  if new.deleted_at is not null and old.deleted_at is null then
    perform public.audit(new.id, 'gym.deleted', new.id, jsonb_build_object('gym', new.name));
  elsif new.deleted_at is null and old.deleted_at is not null then
    perform public.audit(new.id, 'gym.restored', new.id, jsonb_build_object('gym', new.name));
  elsif new.status is distinct from old.status then
    perform public.audit(new.id, 'gym.status_changed', new.id,
      jsonb_build_object('gym', new.name, 'from', old.status, 'to', new.status));
  end if;

  if new.checkin_poster_version is distinct from old.checkin_poster_version then
    perform public.audit(new.id, 'poster.rotated', new.id, '{}');
  end if;

  select array_agg(key order by key) into v_changed
  from jsonb_each(to_jsonb(new)) n
  where n.key <> all (v_ignore || array['status', 'deleted_at', 'deleted_by', 'checkin_poster_version'])
    and n.value is distinct from to_jsonb(old) -> n.key;
  if v_changed is not null then
    perform public.audit(new.id, 'gym.settings_changed', new.id, jsonb_build_object('fields', to_jsonb(v_changed)));
  end if;
  return null;
end;
$$;

create trigger audit_gyms after insert or update on public.gyms
  for each row execute function public.audit_gyms();

-- Reading the log: one gym's (owner or platform admin) or every gym's (platform
-- admin), newest first, with names. Pass the last id seen as p_before for more.
create function public.audit_entries(p_gym_id uuid, p_before bigint default null, p_limit integer default 50)
returns table (
  id bigint,
  gym_id uuid,
  gym_name text,
  actor_name text,
  actor_platform boolean,
  action text,
  target_id uuid,
  details jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.is_platform_admin() or (p_gym_id is not null and public.auth_role_in(p_gym_id) = 'owner')) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
    select a.id, a.gym_id, g.name, coalesce(nullif(p.full_name, ''), case when a.actor_id is null then 'System' else 'Someone' end),
           a.actor_platform, a.action, a.target_id, a.details, a.created_at
    from public.audit_log a
    left join public.gyms g on g.id = a.gym_id
    left join public.profiles p on p.id = a.actor_id
    where (p_gym_id is null or a.gym_id = p_gym_id)
      and (p_before is null or a.id < p_before)
    order by a.id desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

revoke execute on function public.audit_entries(uuid, bigint, integer) from public, anon;
grant execute on function public.audit_entries(uuid, bigint, integer) to authenticated;

-- Platform view ------------------------------------------------------------------

create function public.require_platform_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.require_platform_admin() from public, anon, authenticated;

-- Every gym with health numbers. Counts and totals only: no member details.
create function public.platform_gyms()
returns table (
  id uuid,
  name text,
  slug text,
  status public.gym_status,
  deleted_at timestamptz,
  platform_plan text,
  currency text,
  created_at timestamptz,
  owner_name text,
  owner_email text,
  owner_phone text,
  members integer,
  team integer,
  active_memberships integer,
  pending_joins integer,
  checkins_7d integer,
  payments_30d integer,
  collected_30d_paise bigint,
  last_activity timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_platform_admin();
  return query
    select g.id, g.name, g.slug, g.status, g.deleted_at, g.platform_plan, g.currency, g.created_at,
      o.full_name, o.email::text, o.phone,
      (select count(*)::integer from public.gym_members m where m.gym_id = g.id and m.role = 'member' and m.status = 'active'),
      (select count(*)::integer from public.gym_members m where m.gym_id = g.id and m.role <> 'member' and m.status = 'active'),
      (select count(distinct s.member_id)::integer from public.subscriptions s
        where s.gym_id = g.id and s.status = 'active' and s.ends_on >= current_date and s.starts_on <= current_date),
      (select count(*)::integer from public.gym_members m where m.gym_id = g.id and m.status = 'pending'),
      (select count(*)::integer from public.checkins c where c.gym_id = g.id and c.checked_in_at > now() - interval '7 days'),
      (select count(*)::integer from public.payments p where p.gym_id = g.id and p.status = 'paid' and p.paid_at > now() - interval '30 days'),
      (select coalesce(sum(p.amount_paise), 0)::bigint from public.payments p where p.gym_id = g.id and p.status = 'paid' and p.paid_at > now() - interval '30 days'),
      greatest(
        g.created_at,
        (select max(c.checked_in_at) from public.checkins c where c.gym_id = g.id),
        (select max(p.created_at) from public.payments p where p.gym_id = g.id),
        (select max(a.created_at) from public.audit_log a where a.gym_id = g.id and not a.actor_platform)
      )
    from public.gyms g
    left join lateral (
      select pr.full_name, u.email, pr.phone
      from public.gym_members m
      join public.profiles pr on pr.id = m.user_id
      join auth.users u on u.id = m.user_id
      where m.gym_id = g.id and m.role = 'owner'
      order by m.joined_at
      limit 1
    ) o on true
    order by g.created_at desc;
end;
$$;

-- One gym: basics, team, counts and monthly totals. Logged, so the owner sees
-- that support looked.
create function public.platform_gym(p_gym_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gym public.gyms;
begin
  perform public.require_platform_admin();
  select * into v_gym from public.gyms where id = p_gym_id;
  if not found then
    raise exception 'Gym not found';
  end if;
  perform public.audit(p_gym_id, 'platform.viewed_gym', p_gym_id, '{}');

  return jsonb_build_object(
    'gym', jsonb_build_object(
      'id', v_gym.id, 'name', v_gym.name, 'slug', v_gym.slug, 'status', v_gym.status,
      'deleted_at', v_gym.deleted_at, 'platform_plan', v_gym.platform_plan, 'currency', v_gym.currency,
      'timezone', v_gym.timezone, 'phone', v_gym.phone, 'address', v_gym.address, 'created_at', v_gym.created_at,
      'sections', jsonb_build_object(
        'checkin', v_gym.checkin_enabled, 'classes', v_gym.classes_enabled, 'workouts', v_gym.workouts_enabled,
        'pt', v_gym.pt_enabled, 'nutrition', v_gym.nutrition_enabled, 'upi', v_gym.upi_id is not null,
        'join_approval', v_gym.join_requires_approval)),
    'team', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', pr.full_name, 'email', u.email, 'phone', pr.phone, 'role', m.role,
        'extra_roles', m.extra_roles, 'status', m.status, 'last_sign_in_at', u.last_sign_in_at
      ) order by array_position(array['owner', 'admin', 'staff', 'trainer']::public.gym_role[], m.role), pr.full_name)
      from public.gym_members m
      join public.profiles pr on pr.id = m.user_id
      join auth.users u on u.id = m.user_id
      where m.gym_id = p_gym_id and m.role <> 'member'), '[]'),
    'counts', jsonb_build_object(
      'members', (select count(*) from public.gym_members where gym_id = p_gym_id and role = 'member' and status = 'active'),
      'pending_joins', (select count(*) from public.gym_members where gym_id = p_gym_id and status = 'pending'),
      'pending_upi', (select count(*) from public.payments where gym_id = p_gym_id and status = 'created'),
      'checkins_30d', (select count(*) from public.checkins where gym_id = p_gym_id and checked_in_at > now() - interval '30 days'),
      'classes_30d', (select count(*) from public.class_sessions where gym_id = p_gym_id and starts_at > now() - interval '30 days' and starts_at <= now()),
      'workouts_30d', (select count(*) from public.workout_logs where gym_id = p_gym_id and performed_at > now() - interval '30 days')),
    'months', coalesce((
      select jsonb_agg(jsonb_build_object('month', mo, 'paise', paise, 'payments', n, 'cash_paise', cash, 'upi_paise', upi) order by mo desc)
      from (
        select to_char(date_trunc('month', p.paid_at), 'YYYY-MM') mo,
               sum(p.amount_paise)::bigint paise,
               count(*) n,
               coalesce(sum(p.amount_paise) filter (where p.method = 'cash'), 0)::bigint cash,
               coalesce(sum(p.amount_paise) filter (where p.method = 'upi'), 0)::bigint upi
        from public.payments p
        where p.gym_id = p_gym_id and p.status = 'paid' and p.paid_at > date_trunc('month', now()) - interval '5 months'
        group by 1
      ) t), '[]')
  );
end;
$$;

-- Find a person by name, email or phone: their account and gyms. Logged.
create function public.platform_find_people(p_query text)
returns table (
  user_id uuid,
  full_name text,
  email text,
  phone text,
  signed_up_at timestamptz,
  last_sign_in_at timestamptz,
  gym_id uuid,
  gym_name text,
  gym_slug text,
  role public.gym_role,
  extra_roles public.gym_role[],
  member_status public.member_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_q text := trim(coalesce(p_query, ''));
begin
  perform public.require_platform_admin();
  if length(v_q) < 3 then
    raise exception 'Type at least 3 characters';
  end if;
  perform public.audit(null, 'platform.searched_people', null, jsonb_build_object('query', v_q));
  return query
    select pr.id, pr.full_name, u.email::text, pr.phone, u.created_at, u.last_sign_in_at,
           g.id, g.name, g.slug, m.role, m.extra_roles, m.status
    from public.profiles pr
    join auth.users u on u.id = pr.id
    left join public.gym_members m on m.user_id = pr.id
    left join public.gyms g on g.id = m.gym_id
    where u.email ilike '%' || v_q || '%'
       or pr.full_name ilike '%' || v_q || '%'
       or regexp_replace(coalesce(pr.phone, ''), '\D', '', 'g') like '%' || regexp_replace(v_q, '\D', '', 'g') || '%'
          and length(regexp_replace(v_q, '\D', '', 'g')) >= 4
    order by pr.full_name, g.name
    limit 100;
end;
$$;

-- Suspend a gym (members and staff lose access, data kept), make it active
-- again, or restore one its owner deleted. Logged.
create function public.platform_set_gym_status(p_gym_id uuid, p_status public.gym_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_platform_admin();
  if p_status = 'active' then
    update public.gyms set status = 'active', deleted_at = null, deleted_by = null where id = p_gym_id;
  else
    update public.gyms set status = p_status where id = p_gym_id;
  end if;
  if not found then
    raise exception 'Gym not found';
  end if;
end;
$$;

revoke execute on function public.platform_gyms() from public, anon;
revoke execute on function public.platform_gym(uuid) from public, anon;
revoke execute on function public.platform_find_people(text) from public, anon;
revoke execute on function public.platform_set_gym_status(uuid, public.gym_status) from public, anon;
grant execute on function public.platform_gyms() to authenticated;
grant execute on function public.platform_gym(uuid) to authenticated;
grant execute on function public.platform_find_people(text) to authenticated;
grant execute on function public.platform_set_gym_status(uuid, public.gym_status) to authenticated;
