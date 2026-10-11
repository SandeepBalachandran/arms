-- Profile photos. People's faces are personal data, so unlike gym logos they
-- live in a private bucket and are read through short-lived signed URLs.
--
-- Files are stored as avatars/<user id>/<name>.jpg and profiles.avatar_url
-- holds that storage path (not a URL). Who can open a photo matches who can
-- read the profile: the person, the team (owner, admin, staff, trainer) of
-- any gym they belong to, and platform admins. Other members never can.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- A profile can only point at a photo in its own folder, so nobody can show
-- up with someone else's face.
update public.profiles set avatar_url = null where avatar_url is not null and avatar_url not like id::text || '/%';
alter table public.profiles
  add constraint profiles_avatar_own_folder check (avatar_url is null or avatar_url like id::text || '/%');

-- True when the caller may see the photos in this user's folder. Takes the
-- folder name as text so a malformed path is simply "no".
create function public.can_see_avatar(p_folder text)
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
$$;

create policy "avatars_select" on storage.objects for select to authenticated using (
  bucket_id = 'avatars' and public.can_see_avatar((storage.foldername(name))[1])
);
-- Your own folder only. The front desk sets members' photos through the
-- server, after checking its role.
create policy "avatars_insert_own" on storage.objects for insert to authenticated with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "avatars_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_delete_own" on storage.objects for delete to authenticated using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);
