-- Opening hours (morning and evening session per weekday) and optional
-- personal training: packages the gym sells, a trainer per client, and a log
-- of sessions used.

-- Opening hours -----------------------------------------------------------------

-- {"mon": {"morning": ["05:00", "10:00"], "evening": ["16:00", "21:00"]}, …}
-- A missing or null session means closed for that part of the day. Validated
-- in the app (packages/shared/src/hours.ts); the DB only checks the shape.
alter table public.gyms
  add column opening_hours jsonb not null default '{
    "mon": {"morning": ["05:00", "10:00"], "evening": ["16:00", "21:00"]},
    "tue": {"morning": ["05:00", "10:00"], "evening": ["16:00", "21:00"]},
    "wed": {"morning": ["05:00", "10:00"], "evening": ["16:00", "21:00"]},
    "thu": {"morning": ["05:00", "10:00"], "evening": ["16:00", "21:00"]},
    "fri": {"morning": ["05:00", "10:00"], "evening": ["16:00", "21:00"]},
    "sat": {"morning": ["05:00", "10:00"], "evening": ["16:00", "21:00"]},
    "sun": {"morning": ["06:00", "10:00"]}
  }'::jsonb check (jsonb_typeof(opening_hours) = 'object'),
  add column opening_hours_note text check (length(opening_hours_note) <= 200);

-- Personal training ---------------------------------------------------------------

alter table public.gyms
  add column pt_enabled boolean not null default false,
  add column pt_show_in_app boolean not null default true,
  add column pt_expiry_warning_sessions integer not null default 2
    check (pt_expiry_warning_sessions between 0 and 50);

create table public.pt_packages (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  name text not null check (length(name) between 2 and 60),
  description text check (length(description) <= 300),
  -- Null: unlimited sessions while the package is valid (e.g. monthly PT).
  sessions integer check (sessions between 1 and 500),
  validity_days integer not null check (validity_days between 1 and 3660),
  price_paise integer not null check (price_paise >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index pt_packages_gym_idx on public.pt_packages (gym_id);

-- A package sold to a member. Name and session count are copied at sale time
-- so later edits to the package don't change what the member bought.
create table public.pt_subscriptions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  member_id uuid not null references public.gym_members (id) on delete cascade,
  trainer_member_id uuid references public.gym_members (id) on delete set null,
  package_id uuid references public.pt_packages (id) on delete set null,
  package_name text not null,
  sessions_total integer check (sessions_total between 1 and 500),
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index pt_subscriptions_gym_idx on public.pt_subscriptions (gym_id, ends_on);
create index pt_subscriptions_member_idx on public.pt_subscriptions (member_id);
create index pt_subscriptions_trainer_idx on public.pt_subscriptions (trainer_member_id);

create table public.pt_sessions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  pt_subscription_id uuid not null references public.pt_subscriptions (id) on delete cascade,
  trainer_member_id uuid references public.gym_members (id) on delete set null,
  session_on date not null,
  notes text check (length(notes) <= 300),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index pt_sessions_sub_idx on public.pt_sessions (pt_subscription_id, session_on);
create index pt_sessions_gym_idx on public.pt_sessions (gym_id, session_on);

alter table public.payments
  add column pt_subscription_id uuid references public.pt_subscriptions (id) on delete set null;

alter table public.pt_packages enable row level security;
alter table public.pt_subscriptions enable row level security;
alter table public.pt_sessions enable row level security;

-- Members see active packages only when the gym shows PT in the app.
create policy "pt_packages_select" on public.pt_packages for select using (
  public.is_gym_team(gym_id)
  or (is_active and public.auth_role_in(gym_id) is not null
      and exists (select 1 from public.gyms g where g.id = gym_id and g.pt_enabled and g.pt_show_in_app))
);
create policy "pt_packages_insert" on public.pt_packages for insert
  with check (public.auth_role_in(gym_id) in ('owner', 'admin'));
create policy "pt_packages_update" on public.pt_packages for update
  using (public.auth_role_in(gym_id) in ('owner', 'admin'))
  with check (public.auth_role_in(gym_id) in ('owner', 'admin'));
create policy "pt_packages_delete" on public.pt_packages for delete using (
  public.auth_role_in(gym_id) in ('owner', 'admin')
  and not exists (select 1 from public.pt_subscriptions s where s.package_id = pt_packages.id)
);

create policy "pt_subscriptions_select" on public.pt_subscriptions for select using (
  public.is_my_membership(member_id) or public.is_gym_team(gym_id)
);
-- Staff change the trainer or cancel; sales go through sell_pt_package().
create policy "pt_subscriptions_update" on public.pt_subscriptions for update
  using (public.is_gym_staff(gym_id))
  with check (public.is_gym_staff(gym_id));

create policy "pt_sessions_select" on public.pt_sessions for select using (
  public.is_gym_team(gym_id)
  or exists (select 1 from public.pt_subscriptions s
             where s.id = pt_subscription_id and public.is_my_membership(s.member_id))
);

-- Sell a PT package at the front desk: creates the client's package and a
-- paid payment (with a receipt number). Returns the pt_subscription id.
create function public.sell_pt_package(
  p_member_id uuid,
  p_package_id uuid,
  p_trainer_member_id uuid,
  p_method public.payment_method,
  p_starts_on date default null,
  p_amount_paise integer default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.gym_members;
  v_gym public.gyms;
  v_package public.pt_packages;
  v_start date;
  v_id uuid;
begin
  select * into v_member from public.gym_members where id = p_member_id;
  if not found or not public.is_gym_staff(v_member.gym_id) then
    raise exception 'Not allowed';
  end if;
  select * into v_gym from public.gyms where id = v_member.gym_id;
  if not v_gym.pt_enabled then
    raise exception 'Personal training is turned off for this gym';
  end if;
  if not (p_method = any (v_gym.manual_payment_methods)) then
    raise exception 'This gym does not accept that payment method';
  end if;
  select * into v_package from public.pt_packages where id = p_package_id and gym_id = v_gym.id;
  if not found then
    raise exception 'Package not found';
  end if;
  if p_trainer_member_id is not null and not exists (
    select 1 from public.gym_members
    where id = p_trainer_member_id and gym_id = v_gym.id and status = 'active' and role <> 'member'
  ) then
    raise exception 'Trainer not found';
  end if;
  if p_amount_paise is not null and p_amount_paise < 0 then
    raise exception 'Amount can''t be negative';
  end if;

  v_start := coalesce(p_starts_on, (now() at time zone v_gym.timezone)::date);
  insert into public.pt_subscriptions
    (gym_id, member_id, trainer_member_id, package_id, package_name, sessions_total, starts_on, ends_on, created_by)
  values
    (v_gym.id, p_member_id, p_trainer_member_id, v_package.id, v_package.name, v_package.sessions,
     v_start, v_start + v_package.validity_days - 1, auth.uid())
  returning id into v_id;

  insert into public.payments
    (gym_id, member_id, pt_subscription_id, amount_paise, method, status, paid_at, recorded_by, note)
  values
    (v_gym.id, p_member_id, v_id, coalesce(p_amount_paise, v_package.price_paise), p_method, 'paid', now(), auth.uid(),
     nullif(trim(p_note), ''));

  return v_id;
end;
$$;

-- Log one session against a client's package. Staff, or the client's own
-- trainer, may log. Rejects cancelled packages, dates outside the validity,
-- and packs with no sessions left.
create function public.log_pt_session(
  p_pt_subscription_id uuid,
  p_session_on date default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.pt_subscriptions;
  v_day date;
  v_used integer;
  v_caller uuid;
  v_id uuid;
begin
  -- Lock the package so two people can't log the last session at once.
  select * into v_sub from public.pt_subscriptions where id = p_pt_subscription_id for update;
  if not found then
    raise exception 'Package not found';
  end if;
  select id into v_caller from public.gym_members
  where gym_id = v_sub.gym_id and user_id = auth.uid() and status = 'active';
  if not (public.is_gym_staff(v_sub.gym_id) or (v_caller is not null and v_caller = v_sub.trainer_member_id)) then
    raise exception 'Only staff or this client''s trainer can log sessions';
  end if;
  if v_sub.status <> 'active' then
    raise exception 'This package was cancelled';
  end if;

  v_day := coalesce(p_session_on,
    (now() at time zone (select timezone from public.gyms where id = v_sub.gym_id))::date);
  if v_day < v_sub.starts_on or v_day > v_sub.ends_on then
    raise exception 'The package isn''t valid on that date';
  end if;
  select count(*) into v_used from public.pt_sessions where pt_subscription_id = v_sub.id;
  if v_sub.sessions_total is not null and v_used >= v_sub.sessions_total then
    raise exception 'No sessions left on this package';
  end if;

  insert into public.pt_sessions (gym_id, pt_subscription_id, trainer_member_id, session_on, notes, created_by)
  values (v_sub.gym_id, v_sub.id, coalesce(v_sub.trainer_member_id, v_caller), v_day,
          nullif(trim(p_notes), ''), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- Undo a logged session: staff, or whoever logged it.
create function public.delete_pt_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.pt_sessions;
begin
  select * into v_session from public.pt_sessions where id = p_session_id;
  if not found then
    raise exception 'Session not found';
  end if;
  if not (public.is_gym_staff(v_session.gym_id) or v_session.created_by = auth.uid()) then
    raise exception 'Not allowed';
  end if;
  delete from public.pt_sessions where id = p_session_id;
end;
$$;

revoke execute on function public.sell_pt_package, public.log_pt_session, public.delete_pt_session from public, anon;
