-- Roles & permissions.
--
-- 1. A person can hold more than one role in a gym: `role` stays their main
--    role, `extra_roles` adds others (e.g. an owner who is also a trainer).
-- 2. What each role may do is a grid the owner edits: gym_role_permissions
--    holds the owner's changes; anything not in it uses default_permission().
--    The owner always has every permission and can't be denied one.
-- 3. Turning sections on/off (manage_sections) and editing gym settings
--    (edit_gym_settings) are owner-only by default; the owner can grant them.
--
-- Reads stay role-based (team members see members, payments etc. as before);
-- the grid governs actions.

-- Multiple roles ---------------------------------------------------------------

alter table public.gym_members
  add column extra_roles public.gym_role[] not null default '{}'
    check (not ('owner' = any (extra_roles)) and not ('member' = any (extra_roles)));

-- The caller's roles in a gym (main role first), or an empty array.
create function public.auth_roles_in(p_gym_id uuid)
returns public.gym_role[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select array[role] || extra_roles from public.gym_members
     where gym_id = p_gym_id and user_id = auth.uid() and status = 'active'),
    '{}'
  )
$$;

-- The caller's highest role (owner > admin > staff > trainer > member), so
-- every existing "role in ('owner', 'admin')" check sees extra roles too.
create or replace function public.auth_role_in(p_gym_id uuid)
returns public.gym_role
language sql
stable
security definer
set search_path = ''
as $$
  select r from unnest(public.auth_roles_in(p_gym_id)) r
  order by array_position(array['owner', 'admin', 'staff', 'trainer', 'member']::public.gym_role[], r)
  limit 1
$$;

-- Permissions -------------------------------------------------------------------

-- Today's behaviour, except gym settings and sections, which are now the
-- owner's unless granted. Keep in step with packages/shared/src/permissions.ts.
create function public.default_permission(p_role public.gym_role, p_permission text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_permission
    when 'manage_members' then p_role in ('admin', 'staff')
    when 'record_payments' then p_role in ('admin', 'staff')
    when 'confirm_upi' then p_role in ('admin', 'staff')
    when 'manage_plans_pricing' then p_role in ('admin')
    when 'check_in_members' then p_role in ('admin', 'staff')
    when 'manage_classes' then p_role in ('admin', 'staff')
    when 'edit_workout_plans' then p_role in ('admin', 'staff', 'trainer')
    when 'assign_workout_plans' then p_role in ('admin', 'staff', 'trainer')
    when 'edit_exercises' then p_role in ('admin', 'staff', 'trainer')
    when 'manage_food_list' then p_role in ('admin', 'staff', 'trainer')
    when 'coach_nutrition' then p_role in ('admin', 'trainer')
    when 'sell_pt' then p_role in ('admin', 'staff')
    when 'view_reports' then p_role in ('admin')
    when 'edit_gym_settings' then false
    when 'manage_sections' then false
    when 'self_check_in' then true
    when 'book_classes' then true
    when 'log_food' then true
    when 'log_workouts' then true
    else false
  end
$$;

create table public.gym_role_permissions (
  gym_id uuid not null references public.gyms (id) on delete cascade,
  role public.gym_role not null check (role <> 'owner'),
  permission text not null check (permission in (
    'manage_members', 'record_payments', 'confirm_upi', 'manage_plans_pricing', 'check_in_members',
    'manage_classes', 'edit_workout_plans', 'assign_workout_plans', 'edit_exercises', 'manage_food_list',
    'coach_nutrition', 'sell_pt', 'view_reports', 'edit_gym_settings', 'manage_sections',
    'self_check_in', 'book_classes', 'log_food', 'log_workouts'
  )),
  allowed boolean not null,
  updated_at timestamptz not null default now(),
  primary key (gym_id, role, permission)
);

alter table public.gym_role_permissions enable row level security;

-- The team reads the grid (the apps hide what you can't do); only the owner
-- edits it. Owner rows can't exist, so the owner can never be denied.
create policy "gym_role_permissions_select" on public.gym_role_permissions for select
  using (public.is_gym_team(gym_id));
create policy "gym_role_permissions_owner_write" on public.gym_role_permissions for all
  using (public.auth_role_in(gym_id) = 'owner')
  with check (public.auth_role_in(gym_id) = 'owner');

-- True when any of the caller's roles in the gym allows the permission.
create function public.has_permission(p_gym_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when 'owner' = any (public.auth_roles_in(p_gym_id)) then true
    else coalesce((
      select bool_or(coalesce(o.allowed, public.default_permission(r, p_permission)))
      from unnest(public.auth_roles_in(p_gym_id)) r
      left join public.gym_role_permissions o
        on o.gym_id = p_gym_id and o.role = r and o.permission = p_permission
    ), false)
  end
$$;

-- Everything the caller may do in a gym, for the apps to show or hide things.
create function public.my_permissions(p_gym_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(p order by p), '{}')
  from unnest(array[
    'manage_members', 'record_payments', 'confirm_upi', 'manage_plans_pricing', 'check_in_members',
    'manage_classes', 'edit_workout_plans', 'assign_workout_plans', 'edit_exercises', 'manage_food_list',
    'coach_nutrition', 'sell_pt', 'view_reports', 'edit_gym_settings', 'manage_sections',
    'self_check_in', 'book_classes', 'log_food', 'log_workouts'
  ]) p
  where public.has_permission(p_gym_id, p)
$$;

-- The full grid with defaults, for the owner's Roles page.
create function public.permission_grid(p_gym_id uuid)
returns table (role public.gym_role, permission text, allowed boolean, is_default boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select r, p, coalesce(o.allowed, public.default_permission(r, p)), o.allowed is null
  from unnest(array['admin', 'staff', 'trainer', 'member']::public.gym_role[]) r
  cross join unnest(array[
    'manage_members', 'record_payments', 'confirm_upi', 'manage_plans_pricing', 'check_in_members',
    'manage_classes', 'edit_workout_plans', 'assign_workout_plans', 'edit_exercises', 'manage_food_list',
    'coach_nutrition', 'sell_pt', 'view_reports', 'edit_gym_settings', 'manage_sections',
    'self_check_in', 'book_classes', 'log_food', 'log_workouts'
  ]) p
  left join public.gym_role_permissions o on o.gym_id = p_gym_id and o.role = r and o.permission = p
  where public.auth_role_in(p_gym_id) = 'owner'
$$;

-- Setting someone's roles ---------------------------------------------------------

-- Main role plus extra roles, in one call. Needs manage_members; only the
-- owner may grant admin; nobody changes the owner's main role, but the owner
-- may add extra roles to their own row (e.g. also a trainer).
create function public.set_member_roles(p_member_id uuid, p_role public.gym_role, p_extra_roles public.gym_role[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.gym_members;
  v_caller public.gym_role;
  v_extra public.gym_role[];
begin
  select * into v_member from public.gym_members where id = p_member_id for update;
  if not found then
    raise exception 'Member not found';
  end if;
  v_caller := public.auth_role_in(v_member.gym_id);
  if v_caller is null or not public.has_permission(v_member.gym_id, 'manage_members') then
    raise exception 'You can''t change roles at this gym' using errcode = '42501';
  end if;

  -- Tidy: no duplicates, never owner/member, never the main role again.
  select coalesce(array_agg(distinct r), '{}') into v_extra
  from unnest(coalesce(p_extra_roles, '{}')) r
  where r not in ('owner', 'member') and r <> p_role;

  if v_member.role = 'owner' then
    if v_caller <> 'owner' then
      raise exception 'Only the owner can change the owner''s roles' using errcode = '42501';
    end if;
    if p_role <> 'owner' then
      raise exception 'The owner stays owner. Transfer ownership first.' using errcode = '42501';
    end if;
  elsif p_role = 'owner' then
    raise exception 'Use transfer ownership to make someone the owner' using errcode = '42501';
  end if;

  if v_caller <> 'owner' and (
    p_role = 'admin' or 'admin' = any (v_extra)
    or v_member.role = 'admin' or 'admin' = any (v_member.extra_roles)
  ) then
    raise exception 'Only the owner can make or change admins' using errcode = '42501';
  end if;

  update public.gym_members set role = p_role, extra_roles = v_extra where id = p_member_id;
end;
$$;
revoke execute on function public.set_member_roles(uuid, public.gym_role, public.gym_role[]) from public, anon;

-- Access rules: actions now follow the grid ------------------------------------------

-- Members: adding and editing people. The owner/admin rules stay.
drop policy "gym_members_insert" on public.gym_members;
create policy "gym_members_insert" on public.gym_members for insert with check (
  public.has_permission(gym_id, 'manage_members')
  and (role not in ('owner', 'admin') or public.auth_role_in(gym_id) = 'owner')
  and (not ('admin' = any (extra_roles)) or public.auth_role_in(gym_id) = 'owner')
);
drop policy "gym_members_update" on public.gym_members;
create policy "gym_members_update" on public.gym_members for update
  using (
    public.has_permission(gym_id, 'manage_members')
    and role <> 'owner'
    and ((role <> 'admin' and not ('admin' = any (extra_roles))) or public.auth_role_in(gym_id) = 'owner')
  )
  with check (
    public.has_permission(gym_id, 'manage_members')
    and (role not in ('owner', 'admin') or public.auth_role_in(gym_id) = 'owner')
    and (not ('admin' = any (extra_roles)) or public.auth_role_in(gym_id) = 'owner')
  );

-- Membership plans and PT packages: prices.
drop policy "plans_insert" on public.plans;
create policy "plans_insert" on public.plans for insert with check (public.has_permission(gym_id, 'manage_plans_pricing'));
drop policy "plans_update" on public.plans;
create policy "plans_update" on public.plans for update
  using (public.has_permission(gym_id, 'manage_plans_pricing'))
  with check (public.has_permission(gym_id, 'manage_plans_pricing'));
drop policy "plans_delete" on public.plans;
create policy "plans_delete" on public.plans for delete using (
  public.has_permission(gym_id, 'manage_plans_pricing')
  and not exists (select 1 from public.subscriptions s where s.plan_id = plans.id)
  and not exists (select 1 from public.payments p where p.plan_id = plans.id)
);
drop policy "pt_packages_insert" on public.pt_packages;
create policy "pt_packages_insert" on public.pt_packages for insert with check (public.has_permission(gym_id, 'manage_plans_pricing'));
drop policy "pt_packages_update" on public.pt_packages;
create policy "pt_packages_update" on public.pt_packages for update
  using (public.has_permission(gym_id, 'manage_plans_pricing'))
  with check (public.has_permission(gym_id, 'manage_plans_pricing'));
drop policy "pt_packages_delete" on public.pt_packages;
create policy "pt_packages_delete" on public.pt_packages for delete using (
  public.has_permission(gym_id, 'manage_plans_pricing')
  and not exists (select 1 from public.pt_subscriptions s where s.package_id = pt_packages.id)
);
drop policy "pt_subscriptions_update" on public.pt_subscriptions;
create policy "pt_subscriptions_update" on public.pt_subscriptions for update
  using (public.has_permission(gym_id, 'sell_pt'))
  with check (public.has_permission(gym_id, 'sell_pt'));

-- Classes.
drop policy "class_types_insert" on public.class_types;
create policy "class_types_insert" on public.class_types for insert with check (public.has_permission(gym_id, 'manage_classes'));
drop policy "class_types_update" on public.class_types;
create policy "class_types_update" on public.class_types for update
  using (public.has_permission(gym_id, 'manage_classes'))
  with check (public.has_permission(gym_id, 'manage_classes'));
drop policy "class_sessions_insert" on public.class_sessions;
create policy "class_sessions_insert" on public.class_sessions for insert with check (public.has_permission(gym_id, 'manage_classes'));
drop policy "class_sessions_update" on public.class_sessions;
create policy "class_sessions_update" on public.class_sessions for update
  using (public.has_permission(gym_id, 'manage_classes'))
  with check (public.has_permission(gym_id, 'manage_classes'));

-- Workouts.
drop policy "workout_plans_insert" on public.workout_plans;
create policy "workout_plans_insert" on public.workout_plans for insert with check (public.has_permission(gym_id, 'edit_workout_plans'));
drop policy "workout_plans_update" on public.workout_plans;
create policy "workout_plans_update" on public.workout_plans for update
  using (public.has_permission(gym_id, 'edit_workout_plans'))
  with check (public.has_permission(gym_id, 'edit_workout_plans'));
drop policy "workout_plan_items_write" on public.workout_plan_items;
create policy "workout_plan_items_write" on public.workout_plan_items for all
  using (public.has_permission(public.plan_gym_id(plan_id), 'edit_workout_plans'))
  with check (public.has_permission(public.plan_gym_id(plan_id), 'edit_workout_plans'));
drop policy "plan_assignments_write" on public.plan_assignments;
create policy "plan_assignments_write" on public.plan_assignments for all
  using (public.has_permission(gym_id, 'assign_workout_plans'))
  with check (
    public.has_permission(gym_id, 'assign_workout_plans')
    and public.plan_gym_id(plan_id) = gym_id
    and exists (select 1 from public.gym_members where id = member_id and gym_id = plan_assignments.gym_id)
  );
drop policy "exercises_insert" on public.exercises;
create policy "exercises_insert" on public.exercises for insert
  with check (gym_id is not null and public.has_permission(gym_id, 'edit_exercises'));
drop policy "exercises_update" on public.exercises;
create policy "exercises_update" on public.exercises for update
  using (gym_id is not null and public.has_permission(gym_id, 'edit_exercises'))
  with check (gym_id is not null and public.has_permission(gym_id, 'edit_exercises'));
drop policy "gym_hidden_exercises_write" on public.gym_hidden_exercises;
create policy "gym_hidden_exercises_write" on public.gym_hidden_exercises for all
  using (public.has_permission(gym_id, 'edit_exercises'))
  with check (public.has_permission(gym_id, 'edit_exercises'));
drop policy "exercise_media_write" on public.exercise_media;
create policy "exercise_media_write" on public.exercise_media for all
  using (public.has_permission(gym_id, 'edit_exercises'))
  with check (
    public.has_permission(gym_id, 'edit_exercises')
    and exists (
      select 1 from public.exercises e
      where e.id = exercise_id and (e.gym_id is null or e.gym_id = exercise_media.gym_id)
    )
  );

-- Members logging their own workouts and food.
drop policy "workout_logs_insert" on public.workout_logs;
create policy "workout_logs_insert" on public.workout_logs for insert
  with check (
    public.is_my_membership(member_id)
    and public.has_permission(gym_id, 'log_workouts')
    and exists (select 1 from public.gym_members where id = member_id and gym_id = workout_logs.gym_id)
  );

drop policy "food_logs_write" on public.food_logs;
create policy "food_logs_write" on public.food_logs for all
  using (public.is_my_membership(member_id))
  with check (public.is_my_membership(member_id) and public.member_in_gym(member_id, gym_id) and public.has_permission(gym_id, 'log_food'));

-- Food list and nutrition coaching.
drop policy "foods_team_write" on public.foods;
create policy "foods_team_write" on public.foods for all
  using (gym_id is not null and member_id is null and public.has_permission(gym_id, 'manage_food_list'))
  with check (gym_id is not null and member_id is null and public.has_permission(gym_id, 'manage_food_list'));

-- Nutrition is health data: the member, plus whoever has coach_nutrition —
-- front desk and admins for every member, trainers only for their own PT
-- clients.
create or replace function public.can_coach(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.gym_members m
    where m.id = p_member_id
      and (
        m.user_id = auth.uid()
        or (public.auth_role_in(m.gym_id) in ('owner', 'admin', 'staff') and public.has_permission(m.gym_id, 'coach_nutrition'))
        or (
          public.has_permission(m.gym_id, 'coach_nutrition')
          and exists (
            select 1 from public.pt_subscriptions s
            join public.gym_members t on t.id = s.trainer_member_id
            where s.member_id = m.id and s.status = 'active'
              and s.ends_on >= current_date - 7 and t.user_id = auth.uid()
          )
        )
      )
  )
$$;

-- Gym settings and sections -------------------------------------------------------

-- Anyone on the team may try; the trigger below decides by column.
drop policy "gyms_update" on public.gyms;
create policy "gyms_update" on public.gyms for update
  using (public.is_gym_team(id) or public.is_platform_admin());

create or replace function public.protect_gym_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- Whole parts of the app: manage_sections.
  v_sections text[] := array[
    'checkin_enabled', 'checkin_poster_enabled', 'checkin_location_required', 'checkin_self_allowed',
    'checkin_only_when_open', 'classes_enabled', 'classes_require_membership', 'workouts_enabled',
    'pt_enabled', 'pt_show_in_app', 'nutrition_enabled', 'nutrition_all_members', 'join_requires_approval'
  ];
  -- Only the database's own functions or the platform change these.
  v_protected text[] := array[
    'slug', 'status', 'platform_plan', 'deleted_at', 'deleted_by', 'receipt_seq',
    'checkin_poster_version', 'created_at'
  ];
  v_new jsonb := to_jsonb(new);
  v_old jsonb := to_jsonb(old);
begin
  -- Signed-in users only; security definer functions and the service role
  -- run as other database roles and are allowed.
  if current_user in ('authenticated', 'anon') and not public.is_platform_admin() then
    if (select bool_or(v_new -> c is distinct from v_old -> c) from unnest(v_protected) c) then
      raise exception 'These gym details can''t be changed here' using errcode = '42501';
    end if;
    if (select bool_or(v_new -> c is distinct from v_old -> c) from unnest(v_sections) c)
       and not public.has_permission(new.id, 'manage_sections') then
      raise exception 'Only the owner (or someone they allow) can turn sections on or off' using errcode = '42501';
    end if;
    if (v_new - v_sections - v_protected) is distinct from (v_old - v_sections - v_protected)
       and not public.has_permission(new.id, 'edit_gym_settings') then
      raise exception 'Only the owner (or someone they allow) can change gym settings' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- Functions: actions now follow the grid ------------------------------------------
-- (generated from each function's latest definition; only the role check changes)

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
  v_is_staff := public.has_permission(v_booking.gym_id, 'manage_classes');
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

create or replace function public.cancel_class_session(p_session_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gym_id uuid;
begin
  select gym_id into v_gym_id from public.class_sessions where id = p_session_id;
  if v_gym_id is null or not public.has_permission(v_gym_id, 'manage_classes') then
    raise exception 'Not allowed';
  end if;
  update public.class_sessions
  set status = 'cancelled', cancel_reason = nullif(trim(p_reason), '')
  where id = p_session_id;
end;
$$;

create or replace function public.create_class_series(
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
  if not found or not public.has_permission(v_type.gym_id, 'manage_classes') then
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

create or replace function public.mark_attendance(p_booking_id uuid, p_attended boolean)
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
    public.has_permission(v_booking.gym_id, 'manage_classes')
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

create or replace function public.cancel_subscription(p_subscription_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gym_id uuid;
begin
  select gym_id into v_gym_id from public.subscriptions where id = p_subscription_id;
  if v_gym_id is null or not public.has_permission(v_gym_id, 'record_payments') then
    raise exception 'Not allowed';
  end if;
  update public.subscriptions
  set status = 'cancelled', cancelled_at = now()
  where id = p_subscription_id and status = 'active';
end;
$$;

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
  v_methods public.payment_method[];
  v_sub_id uuid;
begin
  select * into v_member from public.gym_members where id = p_member_id;
  if not found or not public.has_permission(v_member.gym_id, 'record_payments') then
    raise exception 'Not allowed';
  end if;
  select manual_payment_methods into v_methods from public.gyms where id = v_member.gym_id;
  if not (p_method = any (v_methods)) then
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

create or replace function public.check_in_by_token(p_token text)
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
  if not found or not public.has_permission(v_member.gym_id, 'check_in_members') then
    raise exception 'This member belongs to a different gym';
  end if;

  return public.record_checkin(v_member.id, 'scan');
end;
$$;

create or replace function public.staff_check_in(p_member_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gym_id uuid;
begin
  select gym_id into v_gym_id from public.gym_members where id = p_member_id;
  if v_gym_id is null or not public.has_permission(v_gym_id, 'check_in_members') then
    raise exception 'Not allowed';
  end if;
  return public.record_checkin(p_member_id, 'manual');
end;
$$;

create or replace function public.checkin_poster_key(p_gym_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_version integer;
begin
  if not public.has_permission(p_gym_id, 'check_in_members') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select checkin_poster_version into v_version from public.gyms where id = p_gym_id;
  return v_version || '.' || public.checkin_signature('poster:' || p_gym_id || ':' || v_version);
end;
$$;

create or replace function public.confirm_upi_payment(p_payment_id uuid, p_starts_on date default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
  v_sub_id uuid;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found or not public.has_permission(v_payment.gym_id, 'confirm_upi') then
    raise exception 'Not allowed';
  end if;
  if v_payment.status <> 'created' then
    raise exception 'This payment was already reviewed';
  end if;
  if v_payment.plan_id is null then
    raise exception 'The plan for this payment no longer exists';
  end if;

  v_sub_id := public.start_subscription(v_payment.member_id, v_payment.plan_id, p_starts_on);

  update public.payments
  set status = 'paid', subscription_id = v_sub_id, paid_at = now(),
      reviewed_at = now(), recorded_by = auth.uid()
  where id = p_payment_id;

  return v_sub_id;
end;
$$;

create or replace function public.reject_upi_payment(p_payment_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found or not public.has_permission(v_payment.gym_id, 'confirm_upi') then
    raise exception 'Not allowed';
  end if;
  if v_payment.status <> 'created' then
    raise exception 'This payment was already reviewed';
  end if;

  update public.payments
  set status = 'failed', reviewed_at = now(), recorded_by = auth.uid(),
      note = coalesce(nullif(trim(p_reason), ''), 'Payment not received')
  where id = p_payment_id;
end;
$$;

create or replace function public.sell_pt_package(
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
  if not found or not public.has_permission(v_member.gym_id, 'sell_pt') then
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

create or replace function public.log_pt_session(
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
  if not (public.has_permission(v_sub.gym_id, 'sell_pt') or (v_caller is not null and v_caller = v_sub.trainer_member_id)) then
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

create or replace function public.delete_pt_session(p_session_id uuid)
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
  if not (public.has_permission(v_session.gym_id, 'sell_pt') or v_session.created_by = auth.uid()) then
    raise exception 'Not allowed';
  end if;
  delete from public.pt_sessions where id = p_session_id;
end;
$$;

create or replace function public.review_join_request(p_member_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.gym_members;
begin
  select * into v_member from public.gym_members where id = p_member_id;
  if not found or not public.has_permission(v_member.gym_id, 'manage_members') then
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

create or replace function public.promote_member_food(p_food_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_food public.foods;
  v_id uuid;
begin
  select * into v_food from public.foods where id = p_food_id and member_id is not null;
  if v_food.id is null or not public.can_coach(v_food.member_id) or not public.has_permission(v_food.gym_id, 'manage_food_list') then
    raise exception 'Food not found' using errcode = '42501';
  end if;

  select id into v_id from public.foods
  where gym_id = v_food.gym_id and member_id is null and lower(name) = lower(v_food.name);
  if v_id is not null then
    update public.foods set is_active = true where id = v_id;
    return v_id;
  end if;

  insert into public.foods (gym_id, name, name_ml, category, serving_label, serving_g, kcal, protein_g, carbs_g, fat_g, food_type)
  values (v_food.gym_id, v_food.name, v_food.name_ml, v_food.category, v_food.serving_label, v_food.serving_g,
          v_food.kcal, v_food.protein_g, v_food.carbs_g, v_food.fat_g, v_food.food_type)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.rotate_checkin_poster(p_gym_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.has_permission(p_gym_id, 'edit_gym_settings') is false then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.gyms set checkin_poster_version = checkin_poster_version + 1 where id = p_gym_id;
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
  perform public.assert_checkin_hours(p_gym_id);
  if not public.has_permission(p_gym_id, 'self_check_in') then
    raise exception 'App check-in is turned off for your role at this gym' using errcode = '42501';
  end if;
  return public.record_checkin(v_member_id, 'self');
end;
$$;

create or replace function public.poster_check_in(
  p_slug text,
  p_key text,
  p_lat double precision default null,
  p_lng double precision default null,
  p_accuracy_m double precision default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gym public.gyms;
  v_member_id uuid;
  v_distance double precision;
begin
  select * into v_gym from public.gyms where slug = lower(trim(p_slug)) and status = 'active';
  if not found or not v_gym.checkin_enabled or not v_gym.checkin_poster_enabled then
    raise exception 'This gym doesn''t use QR check-in';
  end if;
  if p_key is distinct from v_gym.checkin_poster_version || '.' ||
      public.checkin_signature('poster:' || v_gym.id || ':' || v_gym.checkin_poster_version) then
    raise exception 'This QR code is out of date. Ask the front desk for the new one.';
  end if;

  select id into v_member_id from public.gym_members
  where gym_id = v_gym.id and user_id = auth.uid() and status = 'active';
  if v_member_id is null then
    raise exception 'You''re not a member of %. Join the gym first.', v_gym.name;
  end if;
  if not public.has_permission(v_gym.id, 'self_check_in') then
    raise exception 'App check-in is turned off for your role at this gym' using errcode = '42501';
  end if;

  perform public.assert_checkin_hours(v_gym.id);

  if v_gym.checkin_location_required and v_gym.latitude is not null and v_gym.longitude is not null then
    if p_lat is null or p_lng is null then
      raise exception 'Turn on location so the app can tell you''re at the gym.';
    end if;
    v_distance := public.distance_m(v_gym.latitude, v_gym.longitude, p_lat, p_lng);
    if v_distance > v_gym.checkin_radius_m + least(coalesce(p_accuracy_m, 0), 500) then
      raise exception 'You seem to be about % km from the gym. Check in when you''re there.',
        round((v_distance / 1000)::numeric, 1);
    end if;
  end if;

  return public.record_checkin(v_member_id, 'poster') || jsonb_build_object('gym_id', v_gym.id, 'gym_name', v_gym.name);
end;
$$;

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
  if not public.has_permission(v_gym.id, 'book_classes') then
    raise exception 'Booking classes in the app is turned off for your role at this gym' using errcode = '42501';
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
