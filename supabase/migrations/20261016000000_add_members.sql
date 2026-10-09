-- Staff can add members directly (walk-ins, people without the app). The web
-- server creates the login with the service role; this helper finds an
-- existing account by email or phone so the same person isn't created twice.
-- Service role only.

create function public.find_user_id(p_email text default null, p_phone text default null)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from auth.users
  where (p_email is not null and lower(email) = lower(p_email))
     or (p_phone is not null and phone = p_phone)
  limit 1
$$;

revoke execute on function public.find_user_id(text, text) from public, anon, authenticated;
grant execute on function public.find_user_id(text, text) to service_role;
