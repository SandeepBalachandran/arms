-- Memberships: plans a gym sells, subscriptions members hold, and payments.
-- Money is stored in the smallest currency unit (paise for INR).
-- Subscriptions and payments are written only through the RPCs below (and,
-- from Phase 3, the Razorpay webhook via the service role).

create type public.subscription_status as enum ('active', 'cancelled', 'expired');
create type public.payment_method as enum ('online', 'cash', 'upi', 'card', 'bank_transfer');
create type public.payment_status as enum ('created', 'paid', 'failed', 'refunded');

alter table public.gyms add column receipt_seq integer not null default 0;

-- Plans -------------------------------------------------------------------------

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  name text not null check (length(name) between 2 and 60),
  description text check (length(description) <= 300),
  price_paise integer not null check (price_paise >= 0),
  duration_days integer not null check (duration_days between 1 and 3660),
  class_credits integer check (class_credits >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index plans_gym_idx on public.plans (gym_id, sort_order);

-- Subscriptions -----------------------------------------------------------------
-- 'active' includes subscriptions that start in the future (renewals stack
-- after the current one). Clients treat ends_on < today as expired even
-- before the hourly job flips the status.

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  member_id uuid not null references public.gym_members (id) on delete cascade,
  plan_id uuid references public.plans (id) on delete set null,
  plan_name text not null,
  price_paise integer not null,
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  status public.subscription_status not null default 'active',
  cancelled_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index subscriptions_member_idx on public.subscriptions (member_id, ends_on desc);
create index subscriptions_gym_status_idx on public.subscriptions (gym_id, status, ends_on);

-- Payments ----------------------------------------------------------------------

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  member_id uuid not null references public.gym_members (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  amount_paise integer not null check (amount_paise >= 0),
  method public.payment_method not null,
  status public.payment_status not null default 'created',
  receipt_no integer,
  razorpay_order_id text unique,
  razorpay_payment_id text unique,
  note text check (length(note) <= 300),
  paid_at timestamptz,
  recorded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (gym_id, receipt_no)
);

create index payments_gym_paid_idx on public.payments (gym_id, paid_at desc);
create index payments_member_idx on public.payments (member_id, created_at desc);

-- Give every paid payment the gym's next receipt number.
create function public.assign_receipt_no()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'paid' and new.receipt_no is null then
    update public.gyms set receipt_seq = receipt_seq + 1
    where id = new.gym_id
    returning receipt_seq into new.receipt_no;
  end if;
  return new;
end;
$$;

create trigger payments_receipt_no
  before insert or update of status on public.payments
  for each row execute function public.assign_receipt_no();

-- Helpers -----------------------------------------------------------------------

-- True when the gym_members row belongs to the caller.
create function public.is_my_membership(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.gym_members where id = p_member_id and user_id = auth.uid())
$$;

-- Today's date in the gym's timezone.
create function public.gym_today(p_gym_id uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (now() at time zone timezone)::date from public.gyms where id = p_gym_id
$$;

-- RLS ---------------------------------------------------------------------------

alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;

-- Members see active plans of their gyms; the team sees all of them.
create policy "plans_select" on public.plans for select using (
  (is_active and public.auth_role_in(gym_id) is not null) or public.is_gym_team(gym_id)
);
create policy "plans_insert" on public.plans for insert
  with check (public.auth_role_in(gym_id) in ('owner', 'admin'));
create policy "plans_update" on public.plans for update
  using (public.auth_role_in(gym_id) in ('owner', 'admin'))
  with check (public.auth_role_in(gym_id) in ('owner', 'admin'));

create policy "subscriptions_select" on public.subscriptions for select using (
  public.is_my_membership(member_id) or public.is_gym_team(gym_id)
);

-- Payments are visible to the member and to front-desk staff (not trainers).
create policy "payments_select" on public.payments for select using (
  public.is_my_membership(member_id) or public.is_gym_staff(gym_id)
);

-- RPCs --------------------------------------------------------------------------

-- Front desk sells a plan for cash/UPI/card. Creates the subscription and a
-- paid payment. Without p_starts_on the plan starts today, or the day after
-- the member's current subscription ends (renewal). Returns the subscription id.
create function public.record_manual_payment(
  p_member_id uuid,
  p_plan_id uuid,
  p_method public.payment_method,
  p_starts_on date default null,
  p_amount_paise integer default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.gym_members;
  v_plan public.plans;
  v_start date;
  v_sub_id uuid;
begin
  select * into v_member from public.gym_members where id = p_member_id;
  if not found or not public.is_gym_staff(v_member.gym_id) then
    raise exception 'Not allowed';
  end if;
  if p_method = 'online' then
    raise exception 'Online payments go through checkout';
  end if;

  select * into v_plan from public.plans where id = p_plan_id and gym_id = v_member.gym_id;
  if not found then
    raise exception 'Plan not found';
  end if;

  v_start := coalesce(
    p_starts_on,
    greatest(
      public.gym_today(v_member.gym_id),
      (select max(ends_on) + 1 from public.subscriptions
       where member_id = p_member_id and status = 'active')
    )
  );

  insert into public.subscriptions
    (gym_id, member_id, plan_id, plan_name, price_paise, starts_on, ends_on, created_by)
  values
    (v_member.gym_id, p_member_id, v_plan.id, v_plan.name, v_plan.price_paise,
     v_start, v_start + v_plan.duration_days - 1, auth.uid())
  returning id into v_sub_id;

  insert into public.payments
    (gym_id, member_id, subscription_id, amount_paise, method, status, paid_at, recorded_by, note)
  values
    (v_member.gym_id, p_member_id, v_sub_id, coalesce(p_amount_paise, v_plan.price_paise),
     p_method, 'paid', now(), auth.uid(), nullif(trim(p_note), ''));

  return v_sub_id;
end;
$$;

create function public.cancel_subscription(p_subscription_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gym_id uuid;
begin
  select gym_id into v_gym_id from public.subscriptions where id = p_subscription_id;
  if v_gym_id is null or not public.is_gym_staff(v_gym_id) then
    raise exception 'Not allowed';
  end if;
  update public.subscriptions
  set status = 'cancelled', cancelled_at = now()
  where id = p_subscription_id and status = 'active';
end;
$$;

revoke execute on function public.record_manual_payment(uuid, uuid, public.payment_method, date, integer, text) from anon;
revoke execute on function public.cancel_subscription(uuid) from anon;

-- Expiry job ----------------------------------------------------------------------

-- Marks subscriptions past their end date (in each gym's timezone) as expired.
create function public.expire_subscriptions()
returns integer
language sql
security definer
set search_path = ''
as $$
  with expired as (
    update public.subscriptions s
    set status = 'expired'
    from public.gyms g
    where g.id = s.gym_id
      and s.status = 'active'
      and s.ends_on < (now() at time zone g.timezone)::date
    returning 1
  )
  select count(*)::integer from expired
$$;

revoke execute on function public.expire_subscriptions() from public, anon, authenticated;

create extension if not exists pg_cron;
-- Hourly, so every timezone flips shortly after its midnight.
select cron.schedule('expire-subscriptions', '5 * * * *', 'select public.expire_subscriptions()');
