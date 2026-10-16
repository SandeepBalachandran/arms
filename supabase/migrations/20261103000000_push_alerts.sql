-- Phone alerts for the gym team (web push to the installed admin app).
-- First alert: a member says they paid by UPI, so whoever confirms UPI
-- payments hears about it straight away instead of on the next page load.
--
-- push_subscriptions: one row per device that turned alerts on. The browser
--   gives an endpoint plus two keys; the server encrypts each alert for them.
-- push_sent: alerts already sent, so a retried request doesn't buzz twice.
-- permission_holders(): who in a gym has a permission, for the server to pick
--   recipients (has_permission() only answers for the signed-in caller).

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%' and length(endpoint) <= 1000),
  p256dh text not null check (length(p256dh) <= 200),
  auth text not null check (length(auth) <= 100),
  user_agent text check (length(user_agent) <= 300),
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
create policy "push_subscriptions_select_own" on public.push_subscriptions for select using (user_id = auth.uid());
create policy "push_subscriptions_insert_own" on public.push_subscriptions for insert with check (user_id = auth.uid());
create policy "push_subscriptions_update_own" on public.push_subscriptions for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "push_subscriptions_delete_own" on public.push_subscriptions for delete using (user_id = auth.uid());

create table public.push_sent (
  key text primary key,
  created_at timestamptz not null default now()
);
alter table public.push_sent enable row level security;
revoke all on public.push_sent from authenticated, anon;

-- Same rule as has_permission(): the owner may do everything; otherwise any
-- of the person's roles allows it, by the owner's override or the default.
create function public.permission_holders(p_gym_id uuid, p_permission text)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id
  from public.gym_members m
  where m.gym_id = p_gym_id and m.status = 'active'
    and (
      m.role = 'owner'
      or exists (
        select 1
        from unnest(array[m.role] || m.extra_roles) r
        left join public.gym_role_permissions o
          on o.gym_id = p_gym_id and o.role = r and o.permission = p_permission
        where coalesce(o.allowed, public.default_permission(r, p_permission))
      )
    )
$$;
revoke execute on function public.permission_holders(uuid, text) from public, authenticated, anon;
grant execute on function public.permission_holders(uuid, text) to service_role;
