-- Members can only check themselves in (button or poster) while the gym is
-- open, from 15 minutes before a session starts until it ends. Staff check-ins
-- (desk scan, by name) are never blocked: staff being there means it's open.
-- Gyms can turn this off; a gym with no hours set is never blocked.

alter table public.gyms
  add column checkin_only_when_open boolean not null default true;

-- Is the gym open now (in its own time zone), allowing p_early_min minutes
-- before each session? Hours are {"mon": {"morning": ["05:00","10:00"], ...}}.
create function public.gym_open_now(p_gym_id uuid, p_early_min integer default 15)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hours jsonb;
  v_tz text;
  v_local timestamp;
  v_now_min integer;
  v_day jsonb;
  v_range jsonb;
  v_open integer;
  v_close integer;
  v_has_hours boolean;
begin
  select opening_hours, timezone into v_hours, v_tz from public.gyms where id = p_gym_id;

  -- No sessions set anywhere: nothing to enforce.
  select exists (
    select 1
    from jsonb_each(case when jsonb_typeof(v_hours) = 'object' then v_hours else '{}' end) d,
         jsonb_each(case when jsonb_typeof(d.value) = 'object' then d.value else '{}' end) s
    where jsonb_typeof(s.value) = 'array'
  ) into v_has_hours;
  if not v_has_hours then
    return true;
  end if;

  v_local := now() at time zone v_tz;
  v_now_min := extract(hour from v_local)::integer * 60 + extract(minute from v_local)::integer;
  v_day := v_hours -> lower(to_char(v_local, 'Dy'));
  if v_day is null or jsonb_typeof(v_day) <> 'object' then
    return false;
  end if;

  for v_range in select s.value from jsonb_each(v_day) s where jsonb_typeof(s.value) = 'array' loop
    v_open := split_part(v_range ->> 0, ':', 1)::integer * 60 + split_part(v_range ->> 0, ':', 2)::integer;
    v_close := split_part(v_range ->> 1, ':', 1)::integer * 60 + split_part(v_range ->> 1, ':', 2)::integer;
    if v_now_min >= v_open - p_early_min and v_now_min < v_close then
      return true;
    end if;
  end loop;
  return false;
end;
$$;

revoke execute on function public.gym_open_now(uuid, integer) from public, anon;
grant execute on function public.gym_open_now(uuid, integer) to authenticated;

-- Raises the member-facing error when the gym is closed and the gym asks for it.
create function public.assert_checkin_hours(p_gym_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_gym public.gyms;
begin
  select * into v_gym from public.gyms where id = p_gym_id;
  if v_gym.checkin_only_when_open and not public.gym_open_now(p_gym_id) then
    raise exception '% is closed right now. You can check in during opening hours.', v_gym.name
      using errcode = 'P0001', hint = 'gym_closed';
  end if;
end;
$$;

revoke execute on function public.assert_checkin_hours(uuid) from public, anon, authenticated;

create or replace function public.self_check_in(p_gym_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
begin
  select gm.id into v_member_id
  from public.gym_members gm join public.gyms g on g.id = gm.gym_id
  where gm.gym_id = p_gym_id and gm.user_id = auth.uid() and gm.status = 'active'
    and g.checkin_enabled and g.checkin_self_allowed;
  if v_member_id is null then
    raise exception 'Self check-in is not available at this gym';
  end if;
  perform public.assert_checkin_hours(p_gym_id);
  return public.record_checkin(v_member_id, 'self');
end;
$$;

create or replace function public.poster_check_in(
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

  perform public.assert_checkin_hours(v_gym.id);

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
