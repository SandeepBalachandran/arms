-- Owners can delete their gym. Deleting closes it at once (status 'suspended',
-- so the admin, the member app and join links stop showing it) and keeps the
-- data for 30 days so an owner can restore it. A daily job then removes the gym;
-- every gym table cascades from gyms, so all of its data goes with it.
-- Member accounts (auth users, profiles) are shared across gyms and are kept.

alter table public.gyms
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles (id) on delete set null;

create function public.delete_gym(p_gym_id uuid, p_confirm text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gym public.gyms;
begin
  if public.auth_role_in(p_gym_id) is distinct from 'owner' then
    raise exception 'Only an owner can delete the gym' using errcode = '42501';
  end if;
  select * into v_gym from public.gyms where id = p_gym_id for update;
  if v_gym.deleted_at is not null then
    raise exception 'This gym is already deleted';
  end if;
  if lower(trim(coalesce(p_confirm, ''))) <> v_gym.slug then
    raise exception 'Type the gym code exactly to confirm';
  end if;
  update public.gyms
  set status = 'suspended', deleted_at = now(), deleted_by = auth.uid()
  where id = p_gym_id;
end;
$$;

create function public.restore_gym(p_gym_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.auth_role_in(p_gym_id) is distinct from 'owner' then
    raise exception 'Only an owner can restore the gym' using errcode = '42501';
  end if;
  update public.gyms
  set status = 'active', deleted_at = null, deleted_by = null
  where id = p_gym_id and deleted_at > now() - interval '30 days';
  if not found then
    raise exception 'This gym can no longer be restored';
  end if;
end;
$$;

create function public.purge_deleted_gyms()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.gyms where deleted_at < now() - interval '30 days';
$$;

revoke execute on function public.delete_gym(uuid, text) from public, anon;
revoke execute on function public.restore_gym(uuid) from public, anon;
revoke execute on function public.purge_deleted_gyms() from public, anon, authenticated;
grant execute on function public.delete_gym(uuid, text) to authenticated;
grant execute on function public.restore_gym(uuid) to authenticated;

select cron.schedule('purge-deleted-gyms', '20 3 * * *', 'select public.purge_deleted_gyms()');
