-- The signed-in member's PT packages in a gym, with their trainer's name
-- (members can't read other people's profiles directly) and sessions done.
create function public.my_pt_subscriptions(p_gym_id uuid)
returns table (
  id uuid,
  package_name text,
  sessions_total integer,
  starts_on date,
  ends_on date,
  status text,
  trainer_name text,
  sessions jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id, s.package_name, s.sessions_total, s.starts_on, s.ends_on, s.status,
    p.full_name,
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
