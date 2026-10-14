-- The owner can let others edit the Roles & permissions grid ("manage_roles").
-- Off for every role by default. Two limits keep it from being a way around
-- the owner:
--   1. Only the owner decides who has manage_roles (that row of the grid).
--   2. Someone who manages roles can't change the column of a role they hold
--      themselves (an admin can adjust Staff, Trainer and Member, not Admin),
--      so they can't give themselves more.

alter table public.gym_role_permissions drop constraint gym_role_permissions_permission_check;
alter table public.gym_role_permissions add constraint gym_role_permissions_permission_check check (permission in (
  'manage_members', 'record_payments', 'confirm_upi', 'manage_plans_pricing', 'check_in_members',
  'manage_classes', 'edit_workout_plans', 'assign_workout_plans', 'edit_exercises', 'manage_food_list',
  'coach_nutrition', 'sell_pt', 'view_reports', 'edit_gym_settings', 'manage_sections', 'manage_roles',
  'self_check_in', 'book_classes', 'log_food', 'log_workouts'
));

-- default_permission() already answers false for anything it doesn't list,
-- which is the default for manage_roles.

-- Can the caller change this cell of the grid?
create function public.can_edit_grid_cell(p_gym_id uuid, p_role public.gym_role, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.auth_role_in(p_gym_id) = 'owner'
    or (
      public.has_permission(p_gym_id, 'manage_roles')
      and p_permission <> 'manage_roles'
      and not (p_role = any (public.auth_roles_in(p_gym_id)))
    )
$$;

drop policy "gym_role_permissions_owner_write" on public.gym_role_permissions;
create policy "gym_role_permissions_write" on public.gym_role_permissions for all
  using (public.can_edit_grid_cell(gym_id, role, permission))
  with check (public.can_edit_grid_cell(gym_id, role, permission));

create or replace function public.my_permissions(p_gym_id uuid)
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
    'coach_nutrition', 'sell_pt', 'view_reports', 'edit_gym_settings', 'manage_sections', 'manage_roles',
    'self_check_in', 'book_classes', 'log_food', 'log_workouts'
  ]) p
  where public.has_permission(p_gym_id, p)
$$;

-- The full grid with defaults, for the Roles page: the owner and anyone they
-- let manage roles. `editable` says which cells the caller may change.
drop function public.permission_grid(uuid);
create function public.permission_grid(p_gym_id uuid)
returns table (role public.gym_role, permission text, allowed boolean, is_default boolean, editable boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select r, p, coalesce(o.allowed, public.default_permission(r, p)), o.allowed is null,
         public.can_edit_grid_cell(p_gym_id, r, p)
  from unnest(array['admin', 'staff', 'trainer', 'member']::public.gym_role[]) r
  cross join unnest(array[
    'manage_members', 'record_payments', 'confirm_upi', 'manage_plans_pricing', 'check_in_members',
    'manage_classes', 'edit_workout_plans', 'assign_workout_plans', 'edit_exercises', 'manage_food_list',
    'coach_nutrition', 'sell_pt', 'view_reports', 'edit_gym_settings', 'manage_sections', 'manage_roles',
    'self_check_in', 'book_classes', 'log_food', 'log_workouts'
  ]) p
  left join public.gym_role_permissions o on o.gym_id = p_gym_id and o.role = r and o.permission = p
  where public.auth_role_in(p_gym_id) = 'owner' or public.has_permission(p_gym_id, 'manage_roles')
$$;

revoke execute on function public.permission_grid(uuid) from public, anon;
grant execute on function public.permission_grid(uuid) to authenticated;
revoke execute on function public.can_edit_grid_cell(uuid, public.gym_role, text) from public, anon;
grant execute on function public.can_edit_grid_cell(uuid, public.gym_role, text) to authenticated;
