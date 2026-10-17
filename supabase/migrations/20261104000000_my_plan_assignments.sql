-- Who gave the signed-in member each of their workout plans, and when, so the
-- app can say "From Tara Trainer · since 10 Oct" (members can't read other
-- people's profiles directly). Read-only.
create function public.my_plan_assignments(p_gym_id uuid)
returns table (
  plan_id uuid,
  assigned_at timestamptz,
  assigned_by_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.plan_id, a.assigned_at, p.full_name
  from public.plan_assignments a
  join public.gym_members me on me.id = a.member_id
  left join public.gym_members tm on tm.id = a.assigned_by
  left join public.profiles p on p.id = tm.user_id
  where a.gym_id = p_gym_id and me.user_id = auth.uid()
$$;

revoke execute on function public.my_plan_assignments from public, anon;
grant execute on function public.my_plan_assignments to authenticated;
