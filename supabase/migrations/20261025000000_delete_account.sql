-- Deleting an account (required by the Play Store and the DPDP Act).
--
-- The sign-in account (auth.users) goes, and so does the person's personal
-- and health data. The gyms keep their business records (payments, receipts,
-- memberships, PT sessions, visits), since they're needed for accounts and
-- tax; those now point at a "Deleted member" profile with no name, phone or
-- photo. So profiles no longer cascade from auth.users: a trigger erases them
-- instead, whichever way the user is deleted (the app, the dashboard).

alter table public.profiles add column deleted_at timestamptz;
alter table public.profiles drop constraint profiles_id_fkey;

-- Everything personal about a user, in every gym. Business records stay.
create function public.erase_personal_data(p_user_id uuid)
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
  delete from public.nutrition_comments where member_id = any (v_members);
  delete from public.nutrition_targets where member_id = any (v_members);
  delete from public.nutrition_profiles where member_id = any (v_members);
  delete from public.body_metrics where member_id = any (v_members);
  delete from public.workout_logs where member_id = any (v_members);
  delete from public.plan_assignments where member_id = any (v_members);
  -- Staff notes about them, and class spots they no longer need.
  delete from public.member_notes where member_id = any (v_members);
  delete from public.class_bookings where member_id = any (v_members) and status in ('booked', 'waitlisted');

  update public.gym_members set status = 'inactive' where user_id = p_user_id;
  update public.profiles
    set full_name = 'Deleted member', phone = null, avatar_url = null, deleted_at = now()
    where id = p_user_id;
end;
$$;
revoke execute on function public.erase_personal_data(uuid) from public, anon, authenticated;

create function public.handle_user_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.erase_personal_data(old.id);
  return old;
end;
$$;
revoke execute on function public.handle_user_deleted() from public, anon, authenticated;

create trigger on_auth_user_deleted
  after delete on auth.users
  for each row execute function public.handle_user_deleted();

-- "Delete my account", from the app or the admin. Gym owners first delete
-- their gym (Settings), so no gym is left without an owner. The caller
-- removes their photo files first (storage can't be cleared from SQL).
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gym text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  select g.name into v_gym
  from public.gym_members gm
  join public.gyms g on g.id = gm.gym_id
  where gm.user_id = auth.uid() and gm.role = 'owner' and gm.status = 'active' and g.deleted_at is null
  limit 1;
  if v_gym is not null then
    raise exception 'You own %. Delete the gym in Settings first, then delete your account.', v_gym;
  end if;

  delete from auth.users where id = auth.uid();
end;
$$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
