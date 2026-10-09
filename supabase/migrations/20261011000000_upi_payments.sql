-- Direct UPI payments. A member pays the gym's UPI ID from their UPI app,
-- then claims it in GymOS (payment status 'created' = waiting for the gym).
-- Staff check their UPI app and confirm (→ 'paid' + subscription) or reject
-- (→ 'failed'). No gateway, no fees.

alter table public.gyms
  add column upi_id text check (upi_id ~ '^[A-Za-z0-9._-]{2,256}@[A-Za-z0-9]{2,64}$'),
  add column upi_payee_name text check (length(upi_payee_name) between 2 and 80);

alter table public.payments
  add column plan_id uuid references public.plans (id) on delete set null,
  add column utr text check (utr ~ '^[A-Za-z0-9]{6,35}$'),
  add column reviewed_at timestamptz;

-- One open claim per member at a time.
create unique index payments_one_pending_per_member
  on public.payments (member_id) where status = 'created';

create index payments_gym_pending_idx on public.payments (gym_id, created_at) where status = 'created';

-- Shared subscription creation ------------------------------------------------------

-- Starts a subscription for a plan. Without p_starts_on it starts today, or the
-- day after the member's current subscription ends (renewal). Internal: callers
-- check permissions first.
create function public.start_subscription(p_member_id uuid, p_plan_id uuid, p_starts_on date default null)
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

  return v_sub_id;
end;
$$;

revoke execute on function public.start_subscription(uuid, uuid, date) from public, anon, authenticated;

-- record_manual_payment now uses start_subscription (same behaviour).
create or replace function public.record_manual_payment(
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

  v_sub_id := public.start_subscription(p_member_id, p_plan_id, p_starts_on);

  insert into public.payments
    (gym_id, member_id, subscription_id, plan_id, amount_paise, method, status, paid_at, recorded_by, note)
  values
    (v_member.gym_id, p_member_id, v_sub_id, v_plan.id, coalesce(p_amount_paise, v_plan.price_paise),
     p_method, 'paid', now(), auth.uid(), nullif(trim(p_note), ''));

  return v_sub_id;
end;
$$;

-- Member side -------------------------------------------------------------------

-- The signed-in member says they paid for a plan by UPI. Returns the payment id.
create function public.claim_upi_payment(p_gym_id uuid, p_plan_id uuid, p_utr text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
  v_plan public.plans;
  v_payment_id uuid;
begin
  select id into v_member_id from public.gym_members
  where gym_id = p_gym_id and user_id = auth.uid() and status = 'active';
  if v_member_id is null then
    raise exception 'Not a member of this gym';
  end if;
  if (select upi_id from public.gyms where id = p_gym_id) is null then
    raise exception 'This gym does not accept UPI in the app yet';
  end if;

  select * into v_plan from public.plans where id = p_plan_id and gym_id = p_gym_id and is_active;
  if not found then
    raise exception 'Plan not found';
  end if;

  insert into public.payments (gym_id, member_id, plan_id, amount_paise, method, status, utr)
  values (p_gym_id, v_member_id, v_plan.id, v_plan.price_paise, 'upi', 'created',
          nullif(upper(trim(p_utr)), ''))
  returning id into v_payment_id;

  return v_payment_id;
exception
  when unique_violation then
    raise exception 'You already have a payment waiting for the gym to confirm';
end;
$$;

-- The member withdraws their own unconfirmed claim (e.g. the UPI payment failed).
create function public.withdraw_upi_payment(p_payment_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.payments
  where id = p_payment_id and status = 'created' and public.is_my_membership(member_id)
$$;

-- Staff side ----------------------------------------------------------------------

-- Staff saw the money arrive: mark paid and start the subscription.
create function public.confirm_upi_payment(p_payment_id uuid, p_starts_on date default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
  v_sub_id uuid;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found or not public.is_gym_staff(v_payment.gym_id) then
    raise exception 'Not allowed';
  end if;
  if v_payment.status <> 'created' then
    raise exception 'This payment was already reviewed';
  end if;
  if v_payment.plan_id is null then
    raise exception 'The plan for this payment no longer exists';
  end if;

  v_sub_id := public.start_subscription(v_payment.member_id, v_payment.plan_id, p_starts_on);

  update public.payments
  set status = 'paid', subscription_id = v_sub_id, paid_at = now(),
      reviewed_at = now(), recorded_by = auth.uid()
  where id = p_payment_id;

  return v_sub_id;
end;
$$;

-- Staff could not find the money: reject with a reason the member sees.
create function public.reject_upi_payment(p_payment_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found or not public.is_gym_staff(v_payment.gym_id) then
    raise exception 'Not allowed';
  end if;
  if v_payment.status <> 'created' then
    raise exception 'This payment was already reviewed';
  end if;

  update public.payments
  set status = 'failed', reviewed_at = now(), recorded_by = auth.uid(),
      note = coalesce(nullif(trim(p_reason), ''), 'Payment not received')
  where id = p_payment_id;
end;
$$;

revoke execute on function public.claim_upi_payment(uuid, uuid, text) from anon;
revoke execute on function public.withdraw_upi_payment(uuid) from anon;
revoke execute on function public.confirm_upi_payment(uuid, date) from anon;
revoke execute on function public.reject_upi_payment(uuid, text) from anon;
