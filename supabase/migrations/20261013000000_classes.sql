-- Optional group classes. Off by default; a gym turns them on in Settings.
-- Staff define class types and schedule sessions (one-off or weekly series);
-- members book in the app, with a waitlist when a session is full. Booking is
-- relaxed like check-in: no active membership is required, but a plan with a
-- class_credits limit is respected for the period it covers.

create type public.session_status as enum ('scheduled', 'cancelled');
create type public.booking_status as enum ('booked', 'waitlisted', 'cancelled', 'attended', 'no_show');

alter table public.gyms add column classes_enabled boolean not null default false;

create table public.class_types (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  name text not null check (length(name) between 2 and 60),
  description text check (length(description) <= 300),
  default_capacity integer not null default 20 check (default_capacity between 1 and 500),
  default_duration_min integer not null default 60 check (default_duration_min between 5 and 480),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index class_types_gym_idx on public.class_types (gym_id);

create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  class_type_id uuid not null references public.class_types (id) on delete cascade,
  trainer_member_id uuid references public.gym_members (id) on delete set null,
  starts_at timestamptz not null,
  duration_min integer not null check (duration_min between 5 and 480),
  capacity integer not null check (capacity between 1 and 500),
  room text check (length(room) <= 60),
  status public.session_status not null default 'scheduled',
  cancel_reason text check (length(cancel_reason) <= 300),
  created_at timestamptz not null default now()
);

create index class_sessions_gym_time_idx on public.class_sessions (gym_id, starts_at);

create table public.class_bookings (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  session_id uuid not null references public.class_sessions (id) on delete cascade,
  member_id uuid not null references public.gym_members (id) on delete cascade,
  status public.booking_status not null,
  -- Waitlist order; reset each time the member (re)joins the waitlist.
  waitlisted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, member_id)
);

create index class_bookings_member_idx on public.class_bookings (member_id, created_at desc);
create index class_bookings_session_idx on public.class_bookings (session_id, status);

-- RLS ---------------------------------------------------------------------------------

alter table public.class_types enable row level security;
alter table public.class_sessions enable row level security;
alter table public.class_bookings enable row level security;

create policy "class_types_select" on public.class_types for select
  using (public.auth_role_in(gym_id) is not null);
create policy "class_types_insert" on public.class_types for insert
  with check (public.is_gym_staff(gym_id));
create policy "class_types_update" on public.class_types for update
  using (public.is_gym_staff(gym_id)) with check (public.is_gym_staff(gym_id));

create policy "class_sessions_select" on public.class_sessions for select
  using (public.auth_role_in(gym_id) is not null);
create policy "class_sessions_insert" on public.class_sessions for insert
  with check (public.is_gym_staff(gym_id));
create policy "class_sessions_update" on public.class_sessions for update
  using (public.is_gym_staff(gym_id)) with check (public.is_gym_staff(gym_id));

-- Members see their own bookings; the team sees rosters. Writes go through RPCs.
create policy "class_bookings_select" on public.class_bookings for select
  using (public.is_my_membership(member_id) or public.is_gym_team(gym_id));

-- Schedule ---------------------------------------------------------------------------

-- Sessions in a time range with live counts and the caller's own booking.
-- Members can't read other members' bookings, so counts come from here.
create function public.class_schedule(p_gym_id uuid, p_from timestamptz, p_to timestamptz)
returns table (
  id uuid,
  class_type_id uuid,
  class_name text,
  description text,
  trainer_name text,
  starts_at timestamptz,
  duration_min integer,
  capacity integer,
  room text,
  status public.session_status,
  cancel_reason text,
  booked_count integer,
  waitlist_count integer,
  my_booking_id uuid,
  my_status public.booking_status
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id, s.class_type_id, t.name, t.description, p.full_name,
    s.starts_at, s.duration_min, s.capacity, s.room, s.status, s.cancel_reason,
    (select count(*)::integer from public.class_bookings b
      where b.session_id = s.id and b.status in ('booked', 'attended', 'no_show')),
    (select count(*)::integer from public.class_bookings b
      where b.session_id = s.id and b.status = 'waitlisted'),
    mine.id, mine.status
  from public.class_sessions s
  join public.class_types t on t.id = s.class_type_id
  left join public.gym_members tm on tm.id = s.trainer_member_id
  left join public.profiles p on p.id = tm.user_id
  left join public.class_bookings mine
    on mine.session_id = s.id
   and mine.member_id = (select gm.id from public.gym_members gm
                         where gm.gym_id = p_gym_id and gm.user_id = auth.uid())
  where s.gym_id = p_gym_id
    and public.auth_role_in(p_gym_id) is not null
    and s.starts_at >= p_from and s.starts_at < p_to
  order by s.starts_at
$$;

-- Weekly series: one session per chosen weekday (0 = Sunday … 6 = Saturday)
-- at a local time, for a number of weeks from p_start_date. Returns the count.
create function public.create_class_series(
  p_class_type_id uuid,
  p_weekdays integer[],
  p_local_time time,
  p_start_date date,
  p_weeks integer,
  p_trainer_member_id uuid default null,
  p_capacity integer default null,
  p_duration_min integer default null,
  p_room text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type public.class_types;
  v_tz text;
  v_day date;
  v_count integer := 0;
begin
  select * into v_type from public.class_types where id = p_class_type_id;
  if not found or not public.is_gym_staff(v_type.gym_id) then
    raise exception 'Not allowed';
  end if;
  if p_weeks not between 1 and 26 then
    raise exception 'Choose between 1 and 26 weeks';
  end if;
  if p_trainer_member_id is not null and not exists (
    select 1 from public.gym_members
    where id = p_trainer_member_id and gym_id = v_type.gym_id and role <> 'member'
  ) then
    raise exception 'Trainer must be on the gym team';
  end if;

  select timezone into v_tz from public.gyms where id = v_type.gym_id;

  for v_day in
    select d::date from generate_series(p_start_date, p_start_date + (p_weeks * 7 - 1), interval '1 day') d
  loop
    if extract(dow from v_day)::integer = any (p_weekdays) then
      insert into public.class_sessions
        (gym_id, class_type_id, trainer_member_id, starts_at, duration_min, capacity, room)
      values
        (v_type.gym_id, v_type.id, p_trainer_member_id,
         (v_day + p_local_time) at time zone v_tz,
         coalesce(p_duration_min, v_type.default_duration_min),
         coalesce(p_capacity, v_type.default_capacity),
         nullif(trim(p_room), ''));
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

-- Bookings ---------------------------------------------------------------------------

-- Member books a session: 'booked' if there is room, else 'waitlisted'.
-- The session row lock serialises concurrent bookings so capacity holds.
create function public.book_class(p_session_id uuid)
returns public.booking_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.class_sessions;
  v_member_id uuid;
  v_existing public.class_bookings;
  v_booked integer;
  v_sub record;
  v_used integer;
  v_status public.booking_status;
begin
  select * into v_session from public.class_sessions where id = p_session_id for update;
  if not found then
    raise exception 'Class not found';
  end if;
  if not (select classes_enabled from public.gyms where id = v_session.gym_id) then
    raise exception 'Classes are not available at this gym';
  end if;
  if v_session.status <> 'scheduled' then
    raise exception 'This class was cancelled';
  end if;
  if v_session.starts_at <= now() then
    raise exception 'This class has already started';
  end if;

  select id into v_member_id from public.gym_members
  where gym_id = v_session.gym_id and user_id = auth.uid() and status = 'active';
  if v_member_id is null then
    raise exception 'Not a member of this gym';
  end if;

  select * into v_existing from public.class_bookings
  where session_id = p_session_id and member_id = v_member_id;
  if found and v_existing.status in ('booked', 'waitlisted') then
    return v_existing.status;
  end if;

  -- Class credits: only when the plan covering the class date sets a limit.
  select s.starts_on, s.ends_on, p.class_credits into v_sub
  from public.subscriptions s join public.plans p on p.id = s.plan_id
  where s.member_id = v_member_id and s.status = 'active'
    and (v_session.starts_at at time zone (select timezone from public.gyms where id = v_session.gym_id))::date
        between s.starts_on and s.ends_on
  order by s.starts_on
  limit 1;
  if found and v_sub.class_credits is not null then
    select count(*) into v_used
    from public.class_bookings b join public.class_sessions cs on cs.id = b.session_id
    where b.member_id = v_member_id and b.status in ('booked', 'attended', 'no_show')
      and (cs.starts_at at time zone (select timezone from public.gyms where id = v_session.gym_id))::date
          between v_sub.starts_on and v_sub.ends_on;
    if v_used >= v_sub.class_credits then
      raise exception 'You have used all % classes on your plan', v_sub.class_credits;
    end if;
  end if;

  select count(*) into v_booked from public.class_bookings
  where session_id = p_session_id and status in ('booked', 'attended', 'no_show');
  v_status := case when v_booked < v_session.capacity then 'booked' else 'waitlisted' end;

  insert into public.class_bookings (gym_id, session_id, member_id, status, waitlisted_at)
  values (v_session.gym_id, p_session_id, v_member_id, v_status,
          case when v_status = 'waitlisted' then now() end)
  on conflict (session_id, member_id) do update
    set status = excluded.status, waitlisted_at = excluded.waitlisted_at, updated_at = now();

  return v_status;
end;
$$;

-- Cancels a booking (the member's own, or any for staff). A freed spot goes
-- to the first person on the waitlist.
create function public.cancel_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.class_bookings;
  v_session public.class_sessions;
  v_next uuid;
begin
  select * into v_booking from public.class_bookings where id = p_booking_id;
  if not found or not (public.is_my_membership(v_booking.member_id) or public.is_gym_staff(v_booking.gym_id)) then
    raise exception 'Not allowed';
  end if;
  if v_booking.status not in ('booked', 'waitlisted') then
    return;
  end if;

  select * into v_session from public.class_sessions where id = v_booking.session_id for update;

  update public.class_bookings set status = 'cancelled', waitlisted_at = null, updated_at = now()
  where id = p_booking_id;

  if v_booking.status = 'booked' and v_session.status = 'scheduled' and v_session.starts_at > now() then
    select id into v_next from public.class_bookings
    where session_id = v_session.id and status = 'waitlisted'
    order by waitlisted_at
    limit 1;
    if v_next is not null then
      update public.class_bookings set status = 'booked', waitlisted_at = null, updated_at = now()
      where id = v_next;
    end if;
  end if;
end;
$$;

-- Staff cancel a whole session (members see it as cancelled with the reason).
create function public.cancel_class_session(p_session_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gym_id uuid;
begin
  select gym_id into v_gym_id from public.class_sessions where id = p_session_id;
  if v_gym_id is null or not public.is_gym_staff(v_gym_id) then
    raise exception 'Not allowed';
  end if;
  update public.class_sessions
  set status = 'cancelled', cancel_reason = nullif(trim(p_reason), '')
  where id = p_session_id;
end;
$$;

-- Trainer of the session, or staff, marks who came.
create function public.mark_attendance(p_booking_id uuid, p_attended boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.class_bookings;
  v_trainer uuid;
begin
  select * into v_booking from public.class_bookings where id = p_booking_id;
  select trainer_member_id into v_trainer from public.class_sessions where id = v_booking.session_id;
  if v_booking.id is null or not (
    public.is_gym_staff(v_booking.gym_id)
    or exists (select 1 from public.gym_members where id = v_trainer and user_id = auth.uid())
  ) then
    raise exception 'Not allowed';
  end if;
  if v_booking.status not in ('booked', 'attended', 'no_show') then
    raise exception 'Only booked members can be marked';
  end if;
  update public.class_bookings
  set status = case when p_attended then 'attended' else 'no_show' end::public.booking_status,
      updated_at = now()
  where id = p_booking_id;
end;
$$;

revoke execute on function public.class_schedule(uuid, timestamptz, timestamptz) from anon;
revoke execute on function public.create_class_series(uuid, integer[], time, date, integer, uuid, integer, integer, text) from anon;
revoke execute on function public.book_class(uuid) from anon;
revoke execute on function public.cancel_booking(uuid) from anon;
revoke execute on function public.cancel_class_session(uuid, text) from anon;
revoke execute on function public.mark_attendance(uuid, boolean) from anon;
