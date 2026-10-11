-- Members can see the photos of their gym's team (trainers, front desk), so
-- they know who their trainer is. Members' own photos stay team-only.

create or replace function public.can_see_avatar(p_folder text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_folder = auth.uid()::text
    or public.is_platform_admin()
    or exists (
      select 1 from public.gym_members gm
      where gm.user_id::text = p_folder and public.is_gym_team(gm.gym_id)
    )
    or exists (
      select 1 from public.gym_members t
      where t.user_id::text = p_folder
        and t.status = 'active'
        and t.role in ('owner', 'admin', 'staff', 'trainer')
        and public.auth_role_in(t.gym_id) is not null
    )
$$;

-- The PT packages call now also returns the trainer's photo path.
drop function public.my_pt_subscriptions(uuid);
create function public.my_pt_subscriptions(p_gym_id uuid)
returns table (
  id uuid,
  package_name text,
  sessions_total integer,
  starts_on date,
  ends_on date,
  status text,
  trainer_name text,
  trainer_avatar text,
  sessions jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id, s.package_name, s.sessions_total, s.starts_on, s.ends_on, s.status,
    p.full_name, p.avatar_url,
    coalesce((select jsonb_agg(jsonb_build_object('session_on', x.session_on, 'notes', x.notes)
                               order by x.session_on desc, x.created_at desc)
              from public.pt_sessions x where x.pt_subscription_id = s.id), '[]'::jsonb)
  from public.pt_subscriptions s
  join public.gym_members me on me.id = s.member_id
  left join public.gym_members tm on tm.id = s.trainer_member_id
  left join public.profiles p on p.id = tm.user_id
  where s.gym_id = p_gym_id and me.user_id = auth.uid()
  order by s.starts_on desc
$$;

revoke execute on function public.my_pt_subscriptions from public, anon;
grant execute on function public.my_pt_subscriptions to authenticated;
