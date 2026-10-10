-- Optional "scan the gym's QR" check-in. The gym prints a QR poster; members
-- scan it with the app on arrival. Off by default, and separate from the other
-- check-in ways (self, staff scan, by name). An optional location check makes
-- sure the phone is near the gym; it is also off by default.
--
-- The poster carries a signature, not a stored secret (gyms rows are public):
-- sign('poster:<gym id>:<version>'). Bumping the version makes old posters stop
-- working, e.g. if a photo of the poster is shared around.

alter type public.checkin_method add value if not exists 'poster';

alter table public.gyms
  add column checkin_poster_enabled boolean not null default false,
  add column checkin_poster_version integer not null default 1,
  add column checkin_location_required boolean not null default false,
  add column latitude double precision check (latitude between -90 and 90),
  add column longitude double precision check (longitude between -180 and 180),
  add column checkin_radius_m integer not null default 200 check (checkin_radius_m between 50 and 2000);

-- Staff: the code to print on the poster (the app reads it from the QR).
create function public.checkin_poster_key(p_gym_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_version integer;
begin
  if not public.is_gym_staff(p_gym_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select checkin_poster_version into v_version from public.gyms where id = p_gym_id;
  return v_version || '.' || public.checkin_signature('poster:' || p_gym_id || ':' || v_version);
end;
$$;

-- Owners/admins: invalidate printed posters.
create function public.rotate_checkin_poster(p_gym_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(public.auth_role_in(p_gym_id) in ('owner', 'admin'), false) is false then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.gyms set checkin_poster_version = checkin_poster_version + 1 where id = p_gym_id;
end;
$$;

-- Straight-line distance in metres (haversine).
create function public.distance_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ))
$$;

-- Member: scanned the gym's poster. Location is checked only when the gym asks
-- for it and has set its location; the phone's accuracy is allowed for.
create function public.poster_check_in(
  p_slug text,
  p_key text,
  p_lat double precision default null,
  p_lng double precision default null,
  p_accuracy_m double precision default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gym public.gyms;
  v_member_id uuid;
  v_distance double precision;
begin
  select * into v_gym from public.gyms where slug = lower(trim(p_slug)) and status = 'active';
  if not found or not v_gym.checkin_enabled or not v_gym.checkin_poster_enabled then
    raise exception 'This gym doesn''t use QR check-in';
  end if;
  if p_key is distinct from v_gym.checkin_poster_version || '.' ||
      public.checkin_signature('poster:' || v_gym.id || ':' || v_gym.checkin_poster_version) then
    raise exception 'This QR code is out of date. Ask the front desk for the new one.';
  end if;

  select id into v_member_id from public.gym_members
  where gym_id = v_gym.id and user_id = auth.uid() and status = 'active';
  if v_member_id is null then
    raise exception 'You''re not a member of %. Join the gym first.', v_gym.name;
  end if;

  if v_gym.checkin_location_required and v_gym.latitude is not null and v_gym.longitude is not null then
    if p_lat is null or p_lng is null then
      raise exception 'Turn on location so the app can tell you''re at the gym.';
    end if;
    v_distance := public.distance_m(v_gym.latitude, v_gym.longitude, p_lat, p_lng);
    if v_distance > v_gym.checkin_radius_m + least(coalesce(p_accuracy_m, 0), 500) then
      raise exception 'You seem to be about % km from the gym. Check in when you''re there.',
        round((v_distance / 1000)::numeric, 1);
    end if;
  end if;

  return public.record_checkin(v_member_id, 'poster') || jsonb_build_object('gym_id', v_gym.id, 'gym_name', v_gym.name);
end;
$$;

revoke execute on function public.checkin_poster_key(uuid) from public, anon;
revoke execute on function public.rotate_checkin_poster(uuid) from public, anon;
revoke execute on function public.poster_check_in(text, text, double precision, double precision, double precision) from public, anon;
grant execute on function public.checkin_poster_key(uuid) to authenticated;
grant execute on function public.rotate_checkin_poster(uuid) to authenticated;
grant execute on function public.poster_check_in(text, text, double precision, double precision, double precision) to authenticated;
