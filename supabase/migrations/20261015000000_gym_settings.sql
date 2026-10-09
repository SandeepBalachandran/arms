-- Per-gym settings: everything that differs between gyms is configured by the
-- gym's admin instead of being fixed in code.

alter type public.member_status add value if not exists 'pending';

alter table public.gyms
  -- General
  add column phone_country_code text not null default '91' check (phone_country_code ~ '^[0-9]{1,4}$'),
  -- Memberships
  add column expiry_warning_days integer not null default 7 check (expiry_warning_days between 1 and 60),
  add column renewal_message text not null
    default 'Hi {name}, your {gym} membership ends on {date}. Renew at the front desk or in the GymOS app.'
    check (length(renewal_message) between 10 and 500),
  add column receipt_prefix text not null default '' check (receipt_prefix ~ '^[A-Za-z0-9/-]{0,10}$'),
  add column manual_payment_methods public.payment_method[] not null default '{cash,upi,card,bank_transfer}'
    check (cardinality(manual_payment_methods) >= 1 and not ('online' = any (manual_payment_methods))),
  -- Joining
  add column join_requires_approval boolean not null default false,
  -- Check-in
  add column checkin_self_allowed boolean not null default true,
  add column checkin_dedupe_hours integer not null default 3 check (checkin_dedupe_hours between 0 and 24),
  -- Classes
  add column classes_booking_window_days integer not null default 7 check (classes_booking_window_days between 1 and 60),
  add column classes_cancel_cutoff_hours integer not null default 0 check (classes_cancel_cutoff_hours between 0 and 72),
  add column classes_require_membership boolean not null default false;

-- Built-in exercises a gym chooses not to offer.
create table public.gym_hidden_exercises (
  gym_id uuid not null references public.gyms (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  primary key (gym_id, exercise_id)
);

alter table public.gym_hidden_exercises enable row level security;

create policy "gym_hidden_exercises_select" on public.gym_hidden_exercises for select
  using (public.auth_role_in(gym_id) is not null);
create policy "gym_hidden_exercises_write" on public.gym_hidden_exercises for all
  using (public.is_gym_team(gym_id)) with check (public.is_gym_team(gym_id));

-- Joining ----------------------------------------------------------------------------

-- Join a gym by slug. With join_requires_approval the membership starts as
-- 'pending' until staff approve it. Returns the gym id.
create or replace function public.join_gym(p_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gym public.gyms;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select * into v_gym from public.gyms where slug = lower(trim(p_slug)) and status = 'active';
  if not found then
    raise exception 'Gym not found';
  end if;

  insert into public.gym_members (gym_id, user_id, role, status)
  values (v_gym.id, auth.uid(), 'member',
          case when v_gym.join_requires_approval then 'pending' else 'active' end::public.member_status)
  on conflict (gym_id, user_id) do nothing;

  return v_gym.id;
end;
$$;

-- Staff accept or turn down a pending join request.
create function public.review_join_request(p_member_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.gym_members;
begin
  select * into v_member from public.gym_members where id = p_member_id;
  if not found or not public.is_gym_staff(v_member.gym_id) then
    raise exception 'Not allowed';
  end if;
  if v_member.status::text <> 'pending' then
    raise exception 'This request was already handled';
  end if;
  if p_approve then
    update public.gym_members set status = 'active', joined_at = now() where id = p_member_id;
  else
    delete from public.gym_members where id = p_member_id;
  end if;
end;
$$;

revoke execute on function public.review_join_request(uuid, boolean) from anon;

-- Check-in ---------------------------------------------------------------------------

create or replace function public.record_checkin(p_member_id uuid, p_method public.checkin_method)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.gym_members;
  v_window integer;
  v_existing public.checkins;
  v_ends_on date;
  v_today date;
  v_id uuid;
  v_at timestamptz;
begin
  select * into v_member from public.gym_members where id = p_member_id;
  select checkin_dedupe_hours into v_window from public.gyms where id = v_member.gym_id;
  v_today := public.gym_today(v_member.gym_id);

  select max(ends_on) into v_ends_on from public.subscriptions
  where member_id = p_member_id and status = 'active' and starts_on <= v_today and ends_on >= v_today;

  if v_window > 0 then
    select * into v_existing from public.checkins
    where member_id = p_member_id and checked_in_at > now() - make_interval(hours => v_window)
    order by checked_in_at desc limit 1;
  end if;

  if v_existing.id is not null then
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

create or replace function public.self_check_in(p_gym_id uuid)
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
  where gm.gym_id = p_gym_id and gm.user_id = auth.uid() and gm.status = 'active'
    and g.checkin_enabled and g.checkin_self_allowed;
  if v_member_id is null then
    raise exception 'Self check-in is not available at this gym';
  end if;
  return public.record_checkin(v_member_id, 'self');
end;
$$;

-- Classes ----------------------------------------------------------------------------

create or replace function public.book_class(p_session_id uuid)
returns public.booking_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.class_sessions;
  v_gym public.gyms;
  v_member_id uuid;
  v_existing public.class_bookings;
  v_class_day date;
  v_booked integer;
  v_sub record;
  v_used integer;
  v_status public.booking_status;
begin
  select * into v_session from public.class_sessions where id = p_session_id for update;
  if not found then
    raise exception 'Class not found';
  end if;
  select * into v_gym from public.gyms where id = v_session.gym_id;
  if not v_gym.classes_enabled then
    raise exception 'Classes are not available at this gym';
  end if;
  if v_session.status <> 'scheduled' then
    raise exception 'This class was cancelled';
  end if;
  if v_session.starts_at <= now() then
    raise exception 'This class has already started';
  end if;
  if v_session.starts_at > now() + make_interval(days => v_gym.classes_booking_window_days) then
    raise exception 'Booking opens % days before the class', v_gym.classes_booking_window_days;
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

  v_class_day := (v_session.starts_at at time zone v_gym.timezone)::date;

  select s.starts_on, s.ends_on, p.class_credits into v_sub
  from public.subscriptions s left join public.plans p on p.id = s.plan_id
  where s.member_id = v_member_id and s.status = 'active'
    and v_class_day between s.starts_on and s.ends_on
  order by s.starts_on
  limit 1;

  if not found and v_gym.classes_require_membership then
    raise exception 'You need an active membership on the day of the class to book it';
  end if;

  if found and v_sub.class_credits is not null then
    select count(*) into v_used
    from public.class_bookings b join public.class_sessions cs on cs.id = b.session_id
    where b.member_id = v_member_id and b.status in ('booked', 'attended', 'no_show')
      and (cs.starts_at at time zone v_gym.timezone)::date between v_sub.starts_on and v_sub.ends_on;
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

-- Members may not cancel a booked spot inside the gym's cutoff (staff always can;
-- leaving the waitlist is always allowed).
create or replace function public.cancel_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.class_bookings;
  v_session public.class_sessions;
  v_cutoff integer;
  v_is_staff boolean;
  v_next uuid;
begin
  select * into v_booking from public.class_bookings where id = p_booking_id;
  if not found then
    raise exception 'Not allowed';
  end if;
  v_is_staff := public.is_gym_staff(v_booking.gym_id);
  if not (v_is_staff or public.is_my_membership(v_booking.member_id)) then
    raise exception 'Not allowed';
  end if;
  if v_booking.status not in ('booked', 'waitlisted') then
    return;
  end if;

  select * into v_session from public.class_sessions where id = v_booking.session_id for update;
  select classes_cancel_cutoff_hours into v_cutoff from public.gyms where id = v_booking.gym_id;
  if not v_is_staff and v_booking.status = 'booked' and v_cutoff > 0
     and v_session.starts_at - now() < make_interval(hours => v_cutoff) then
    raise exception 'Bookings can only be cancelled up to % hours before the class', v_cutoff;
  end if;

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

-- Payments ---------------------------------------------------------------------------

-- Manual payments must use a method the gym accepts.
create or replace function public.record_manual_payment(
  p_member_id uuid,
  p_plan_id uuid,
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
  v_plan public.plans;
  v_sub_id uuid;
begin
  select * into v_member from public.gym_members where id = p_member_id;
  if not found or not public.is_gym_staff(v_member.gym_id) then
    raise exception 'Not allowed';
  end if;
  if not (p_method = any ((select manual_payment_methods from public.gyms where id = v_member.gym_id))) then
    raise exception 'This gym does not accept that payment method';
  end if;

  select * into v_plan from public.plans where id = p_plan_id and gym_id = v_member.gym_id;
  if not found then
    raise exception 'Plan not found';
  end if;

  v_sub_id := public.start_subscription(p_member_id, p_plan_id, p_starts_on);

  insert into public.payments
    (gym_id, member_id, subscription_id, plan_id, amount_paise, method, status, paid_at, recorded_by, note)
  values
    (v_member.gym_id, p_member_id, v_sub_id, v_plan.id, coalesce(p_amount_paise, v_plan.price_paise),
     p_method, 'paid', now(), auth.uid(), nullif(trim(p_note), ''));

  return v_sub_id;
end;
$$;
