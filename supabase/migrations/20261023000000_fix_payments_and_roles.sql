-- Fixes found by the database tests (tests/db).

-- 1. Recording a desk payment always failed ("operator does not exist:
--    payment_method = payment_method[]"): `= any ((select array))` compares
--    with the whole array. Compare with its elements instead.
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
  v_methods public.payment_method[];
  v_sub_id uuid;
begin
  select * into v_member from public.gym_members where id = p_member_id;
  if not found or not public.is_gym_staff(v_member.gym_id) then
    raise exception 'Not allowed';
  end if;
  select manual_payment_methods into v_methods from public.gyms where id = v_member.gym_id;
  if not (p_method = any (v_methods)) then
    raise exception 'This gym does not accept that payment method';
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

-- 2. Front-desk staff could demote (or deactivate) an admin. Only the owner
--    may change an admin's row; nobody may change the owner's.
drop policy "gym_members_update" on public.gym_members;
create policy "gym_members_update" on public.gym_members for update
  using (
    public.is_gym_staff(gym_id)
    and role <> 'owner'
    and (role <> 'admin' or public.auth_role_in(gym_id) = 'owner')
  )
  with check (
    public.is_gym_staff(gym_id)
    and (role not in ('owner', 'admin') or public.auth_role_in(gym_id) = 'owner')
  );

-- 3. Owners/admins could change any gym column directly, including the billing
--    plan, status and deletion date (e.g. undo a deletion after 30 days, or
--    upgrade their own plan). These are only changed by the database's own
--    functions (delete/restore gym, receipts, poster reprint) or the platform.
create function public.protect_gym_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Signed-in users only; security definer functions and the service role
  -- run as other database roles and are allowed.
  if current_user in ('authenticated', 'anon') and not public.is_platform_admin() then
    if new.slug is distinct from old.slug
       or new.status is distinct from old.status
       or new.platform_plan is distinct from old.platform_plan
       or new.deleted_at is distinct from old.deleted_at
       or new.deleted_by is distinct from old.deleted_by
       or new.receipt_seq is distinct from old.receipt_seq
       or new.checkin_poster_version is distinct from old.checkin_poster_version
       or new.created_at is distinct from old.created_at then
      raise exception 'These gym details can''t be changed here' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger gyms_protect_columns
  before update on public.gyms
  for each row execute function public.protect_gym_columns();
