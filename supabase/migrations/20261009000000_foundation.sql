-- Foundation: tenants (gyms), user profiles, and gym membership roles.
-- Every tenant-scoped table carries gym_id and is protected by RLS built on
-- auth_role_in(gym_id).

create type public.gym_role as enum ('owner', 'admin', 'staff', 'trainer', 'member');
create type public.gym_status as enum ('pending', 'active', 'suspended');
create type public.member_status as enum ('invited', 'active', 'inactive');

-- Profiles ------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text,
  avatar_url text,
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Create a profile for every new auth user.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Gyms ----------------------------------------------------------------------

create table public.gyms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9](-?[a-z0-9])*$' and length(slug) between 3 and 40),
  name text not null check (length(name) between 2 and 80),
  logo_url text,
  timezone text not null default 'Asia/Kolkata',
  currency text not null default 'INR',
  address text,
  phone text,
  status public.gym_status not null default 'active',
  platform_plan text not null default 'trial',
  created_at timestamptz not null default now()
);

-- Razorpay credentials live in their own table so that no member-readable
-- policy on gyms can ever expose them. Only the service role reads this.
create table public.gym_secrets (
  gym_id uuid primary key references public.gyms (id) on delete cascade,
  razorpay_key_id text,
  razorpay_key_secret_enc text,
  razorpay_webhook_secret_enc text,
  updated_at timestamptz not null default now()
);

-- Gym members (staff and members alike) --------------------------------------

create table public.gym_members (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.gym_role not null default 'member',
  status public.member_status not null default 'active',
  joined_at timestamptz not null default now(),
  unique (gym_id, user_id)
);

create index gym_members_user_idx on public.gym_members (user_id);

-- Role helpers ---------------------------------------------------------------

-- The caller's role in a gym, or null when they do not belong to it.
create function public.auth_role_in(p_gym_id uuid)
returns public.gym_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.gym_members
  where gym_id = p_gym_id and user_id = auth.uid() and status = 'active'
$$;

-- True when the caller is owner, admin or staff of the gym.
create function public.is_gym_staff(p_gym_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.auth_role_in(p_gym_id) in ('owner', 'admin', 'staff'), false)
$$;

-- True when the caller is staff or a trainer of the gym.
create function public.is_gym_team(p_gym_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.auth_role_in(p_gym_id) in ('owner', 'admin', 'staff', 'trainer'), false)
$$;

create function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select is_platform_admin from public.profiles where id = auth.uid()), false)
$$;

-- RLS ------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.gyms enable row level security;
alter table public.gym_secrets enable row level security;
alter table public.gym_members enable row level security;

-- Profiles: yourself, plus people in gyms where you are on the team.
create policy "profiles_select" on public.profiles for select using (
  id = auth.uid()
  or public.is_platform_admin()
  or exists (
    select 1 from public.gym_members gm
    where gm.user_id = profiles.id and public.is_gym_team(gm.gym_id)
  )
);
create policy "profiles_update_self" on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());
-- Users may only edit these columns; is_platform_admin is never writable.
revoke update on public.profiles from authenticated, anon;
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;

-- Gyms: public basic info so the join page works; only owner/admin edit.
create policy "gyms_select" on public.gyms for select using (true);
create policy "gyms_update" on public.gyms for update
  using (public.auth_role_in(id) in ('owner', 'admin') or public.is_platform_admin());

-- gym_secrets has no policies: only the service role can touch it.

-- Gym members: your own rows, or every row in a gym where you are on the team.
create policy "gym_members_select" on public.gym_members for select using (
  user_id = auth.uid() or public.is_gym_team(gym_id) or public.is_platform_admin()
);
-- Staff manage members; nobody but the owner may grant owner/admin.
create policy "gym_members_insert" on public.gym_members for insert with check (
  public.is_gym_staff(gym_id)
  and (role not in ('owner', 'admin') or public.auth_role_in(gym_id) = 'owner')
);
create policy "gym_members_update" on public.gym_members for update
  using (public.is_gym_staff(gym_id) and role <> 'owner')
  with check (
    public.is_gym_staff(gym_id)
    and (role not in ('owner', 'admin') or public.auth_role_in(gym_id) = 'owner')
  );

-- RPCs -----------------------------------------------------------------------

-- Register a new gym with the caller as owner. Returns the gym id.
create function public.register_gym(p_name text, p_slug text, p_timezone text default 'Asia/Kolkata')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gym_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  insert into public.gyms (name, slug, timezone)
  values (trim(p_name), lower(trim(p_slug)), p_timezone)
  returning id into v_gym_id;

  insert into public.gym_members (gym_id, user_id, role)
  values (v_gym_id, auth.uid(), 'owner');

  insert into public.gym_secrets (gym_id) values (v_gym_id);

  return v_gym_id;
end;
$$;

-- Join an active gym as a member through its public slug. Idempotent.
create function public.join_gym(p_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gym_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select id into v_gym_id from public.gyms
  where slug = lower(trim(p_slug)) and status = 'active';
  if v_gym_id is null then
    raise exception 'Gym not found';
  end if;

  insert into public.gym_members (gym_id, user_id, role)
  values (v_gym_id, auth.uid(), 'member')
  on conflict (gym_id, user_id) do nothing;

  return v_gym_id;
end;
$$;

revoke execute on function public.register_gym(text, text, text) from anon;
revoke execute on function public.join_gym(text) from anon;
