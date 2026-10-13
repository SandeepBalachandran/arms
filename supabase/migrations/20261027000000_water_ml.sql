-- Water in millilitres instead of fixed glasses, with a daily goal and the
-- containers each member drinks from (glass, bottle, ...).

alter table public.water_logs
  add column ml integer not null default 0 check (ml between 0 and 10000);

update public.water_logs set ml = glasses * 250;

-- Installed apps from before this change still write `glasses`. Keep both
-- columns in step: a write to `ml` sets `glasses` (rounded, 250 ml each),
-- and a write that only changes `glasses` sets `ml`.
create function public.sync_water_units()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.ml = 0 and new.glasses > 0 then
      new.ml := new.glasses * 250;
    end if;
  elsif new.ml is distinct from old.ml then
    null;
  elsif new.glasses is distinct from old.glasses then
    new.ml := new.glasses * 250;
  end if;
  new.glasses := least(30, round(new.ml / 250.0)::integer);
  return new;
end;
$$;

create trigger water_logs_sync_units
  before insert or update on public.water_logs
  for each row execute function public.sync_water_units();

-- Per-member goal and containers. No row means the defaults below.
create table public.water_settings (
  member_id uuid primary key references public.gym_members (id) on delete cascade,
  gym_id uuid not null references public.gyms (id) on delete cascade,
  goal_ml integer not null default 2500 check (goal_ml between 500 and 8000),
  containers jsonb not null default '[{"label":"Glass","ml":250},{"label":"Bottle","ml":500},{"label":"Big bottle","ml":1000}]'
    check (jsonb_typeof(containers) = 'array' and jsonb_array_length(containers) between 1 and 5),
  updated_at timestamptz not null default now()
);

alter table public.water_settings enable row level security;

create policy "water_settings_select" on public.water_settings for select using (public.can_coach(member_id));
create policy "water_settings_write" on public.water_settings for all
  using (public.is_my_membership(member_id))
  with check (public.is_my_membership(member_id) and public.member_in_gym(member_id, gym_id));

-- Account deletion also clears water settings.
create or replace function public.erase_personal_data(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_members uuid[];
begin
  select coalesce(array_agg(id), '{}') into v_members from public.gym_members where user_id = p_user_id;
  -- Health data: food, water, targets, body measurements, workouts.
  delete from public.food_logs where member_id = any (v_members);
  delete from public.water_logs where member_id = any (v_members);
  delete from public.water_settings where member_id = any (v_members);
  delete from public.nutrition_comments where member_id = any (v_members);
  delete from public.nutrition_targets where member_id = any (v_members);
  delete from public.nutrition_profiles where member_id = any (v_members);
  delete from public.body_metrics where member_id = any (v_members);
  delete from public.workout_logs where member_id = any (v_members);
  delete from public.plan_assignments where member_id = any (v_members);
  -- Staff notes about them, their notifications, and class spots they no longer need.
  delete from public.member_notes where member_id = any (v_members);
  delete from public.notifications where member_id = any (v_members);
  delete from public.class_bookings where member_id = any (v_members) and status in ('booked', 'waitlisted');
  update public.gym_members set status = 'inactive' where user_id = p_user_id;
  update public.profiles
    set full_name = 'Deleted member', phone = null, avatar_url = null, deleted_at = now()
    where id = p_user_id;
end;
$$;
revoke execute on function public.erase_personal_data(uuid) from public, anon, authenticated;
