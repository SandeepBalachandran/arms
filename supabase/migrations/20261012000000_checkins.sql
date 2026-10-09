-- Optional check-in. Off by default; a gym turns it on in Settings. When on,
-- members can check themselves in from the app, staff can scan the member's
-- rotating QR code, or check someone in by hand. Nothing is ever refused:
-- an inactive membership is only flagged (membership_ok = false) for staff.

create type public.checkin_method as enum ('self', 'scan', 'manual');

alter table public.gyms add column checkin_enabled boolean not null default false;

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  member_id uuid not null references public.gym_members (id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  method public.checkin_method not null,
  membership_ok boolean not null,
  recorded_by uuid references public.profiles (id) on delete set null
);

create index checkins_gym_time_idx on public.checkins (gym_id, checked_in_at desc);
create index checkins_member_time_idx on public.checkins (member_id, checked_in_at desc);

alter table public.checkins enable row level security;

create policy "checkins_select" on public.checkins for select using (
  public.is_my_membership(member_id) or public.is_gym_team(gym_id)
);

-- Live "who's in" on the admin check-in page.
alter publication supabase_realtime add table public.checkins;

-- Secrets for signing member QR tokens. No policies: only definer functions read it.
create table public.app_secrets (
  name text primary key,
  value text not null
);
alter table public.app_secrets enable row level security;
insert into public.app_secrets (name, value)
values ('checkin_hmac_key', encode(extensions.gen_random_bytes(32), 'hex'));

-- Internal ------------------------------------------------------------------------

-- Records a check-in unless the member already checked in within the last
-- 3 hours (then returns that one). Callers check permissions first.
create function public.record_checkin(p_member_id uuid, p_method public.checkin_method)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.gym_members;
  v_existing public.checkins;
  v_ends_on date;
  v_today date;
  v_id uuid;
  v_at timestamptz;
begin
  select * into v_member from public.gym_members where id = p_member_id;
  v_today := public.gym_today(v_member.gym_id);

  select max(ends_on) into v_ends_on from public.subscriptions
  where member_id = p_member_id and status = 'active' and starts_on <= v_today and ends_on >= v_today;

  select * into v_existing from public.checkins
  where member_id = p_member_id and checked_in_at > now() - interval '3 hours'
  order by checked_in_at desc limit 1;

  if found then
    v_id := v_existing.id;
    v_at := v_existing.checked_in_at;
  else
    insert into public.checkins (gym_id, member_id, method, membership_ok, recorded_by)
    values (v_member.gym_id, p_member_id, p_method, v_ends_on is not null, auth.uid())
    returning id, checked_in_at into v_id, v_at;
  end if;

  return jsonb_build_object(
    'checkin_id', v_id,
    'checked_in_at', v_at,
    'duplicate', v_existing.id is not null,
    'member_id', p_member_id,
    'full_name', (select full_name from public.profiles where id = v_member.user_id),
    'membership_ok', v_ends_on is not null,
    'ends_on', coalesce(v_ends_on,
      (select max(ends_on) from public.subscriptions where member_id = p_member_id and status <> 'cancelled'))
  );
end;
$$;

revoke execute on function public.record_checkin(uuid, public.checkin_method) from public, anon, authenticated;

create function public.checkin_signature(p_payload text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select left(encode(extensions.hmac(p_payload, value, 'sha256'), 'hex'), 24)
  from public.app_secrets where name = 'checkin_hmac_key'
$$;

revoke execute on function public.checkin_signature(text) from public, anon, authenticated;

-- RPCs ------------------------------------------------------------------------------

-- Member: "I'm at the gym".
create function public.self_check_in(p_gym_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
begin
  select gm.id into v_member_id
  from public.gym_members gm join public.gyms g on g.id = gm.gym_id
  where gm.gym_id = p_gym_id and gm.user_id = auth.uid() and gm.status = 'active' and g.checkin_enabled;
  if v_member_id is null then
    raise exception 'Check-in is not available';
  end if;
  return public.record_checkin(v_member_id, 'self');
end;
$$;

-- Member: a short-lived token for their check-in QR code ("gymos-ci:<member>:<epoch>:<sig>").
-- The app refreshes it every minute; scans accept it for 2 minutes.
create function public.issue_checkin_token(p_gym_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
  v_payload text;
begin
  select gm.id into v_member_id
  from public.gym_members gm join public.gyms g on g.id = gm.gym_id
  where gm.gym_id = p_gym_id and gm.user_id = auth.uid() and gm.status = 'active' and g.checkin_enabled;
  if v_member_id is null then
    raise exception 'Check-in is not available';
  end if;
  v_payload := v_member_id || ':' || floor(extract(epoch from now()))::bigint;
  return 'gymos-ci:' || v_payload || ':' || public.checkin_signature(v_payload);
end;
$$;

-- Staff: scanned a member's QR code.
create function public.check_in_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parts text[];
  v_member public.gym_members;
  v_issued bigint;
begin
  v_parts := string_to_array(p_token, ':');
  if array_length(v_parts, 1) <> 4 or v_parts[1] <> 'gymos-ci'
     or v_parts[2] !~ '^[0-9a-f-]{36}$' or v_parts[3] !~ '^[0-9]{1,12}$' then
    raise exception 'Not a GymOS check-in code';
  end if;
  if public.checkin_signature(v_parts[2] || ':' || v_parts[3]) <> v_parts[4] then
    raise exception 'Invalid check-in code';
  end if;

  v_issued := v_parts[3]::bigint;
  if extract(epoch from now()) - v_issued > 120 then
    raise exception 'This code has expired. Ask the member to refresh it.';
  end if;

  select * into v_member from public.gym_members where id = v_parts[2]::uuid;
  if not found or not public.is_gym_staff(v_member.gym_id) then
    raise exception 'This member belongs to a different gym';
  end if;

  return public.record_checkin(v_member.id, 'scan');
end;
$$;

-- Staff: check a member in by hand.
create function public.staff_check_in(p_member_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gym_id uuid;
begin
  select gym_id into v_gym_id from public.gym_members where id = p_member_id;
  if v_gym_id is null or not public.is_gym_staff(v_gym_id) then
    raise exception 'Not allowed';
  end if;
  return public.record_checkin(p_member_id, 'manual');
end;
$$;

revoke execute on function public.self_check_in(uuid) from anon;
revoke execute on function public.issue_checkin_token(uuid) from anon;
revoke execute on function public.check_in_by_token(text) from anon;
revoke execute on function public.staff_check_in(uuid) from anon;
