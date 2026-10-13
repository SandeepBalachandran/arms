-- "My foods": foods a member adds for themselves when something isn't in the
-- built-in or gym list. Private to the member and whoever coaches them
-- (owner, admin, their PT trainer). A coach can copy one into the gym list.

alter table public.foods
  add column member_id uuid references public.gym_members (id) on delete cascade,
  add constraint foods_member_in_gym check (member_id is null or gym_id is not null);

create index foods_member_idx on public.foods (member_id) where member_id is not null;

-- Reading: built-in foods for everyone, the gym's list for its members, and
-- a member's own foods only for them and their coaches. (Before, anyone in
-- the gym could read every row with that gym_id.)
drop policy "foods_select" on public.foods;
create policy "foods_select" on public.foods for select using (
  gym_id is null
  or (member_id is null and public.my_member_id(gym_id) is not null)
  or (member_id is not null and public.can_coach(member_id))
);

-- Writing: the team manages the gym list only; members manage their own.
drop policy "foods_write" on public.foods;
create policy "foods_team_write" on public.foods for all
  using (gym_id is not null and member_id is null and public.is_gym_team(gym_id))
  with check (gym_id is not null and member_id is null and public.is_gym_team(gym_id));
create policy "foods_member_write" on public.foods for all
  using (member_id is not null and public.is_my_membership(member_id))
  with check (member_id is not null and public.is_my_membership(member_id) and public.member_in_gym(member_id, gym_id));

-- Copy a member's food into the gym list so every member can pick it.
-- Returns the gym food's id (an existing one if the name is already listed).
create function public.promote_member_food(p_food_id uuid)
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
  if v_food.id is null or not public.can_coach(v_food.member_id) or not public.is_gym_team(v_food.gym_id) then
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
revoke execute on function public.promote_member_food(uuid) from public, anon;

-- Account deletion also removes the member's own foods.
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
  delete from public.foods where member_id = any (v_members);
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
