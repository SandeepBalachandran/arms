-- In-app notifications for members: what happened (payment confirmed or
-- rejected, a class cancelled, a trainer's comment, a new workout plan, a PT
-- session logged). Written by triggers when it happens; the app turns `kind`
-- and `data` into words (packages/shared/src/notifications.ts). Reminders
-- that depend on the date (membership ending, a class tomorrow) aren't
-- stored: the app works them out when the screen opens.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  member_id uuid not null references public.gym_members (id) on delete cascade,
  kind text not null check (kind in ('payment_paid', 'payment_rejected', 'class_cancelled', 'trainer_comment', 'plan_assigned', 'pt_session')),
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_member_idx on public.notifications (member_id, created_at desc);

alter table public.notifications enable row level security;
create policy "notifications_select_own" on public.notifications for select using (public.is_my_membership(member_id));
-- Members only mark them read; triggers write them.
create policy "notifications_update_own" on public.notifications for update
  using (public.is_my_membership(member_id))
  with check (public.is_my_membership(member_id));
revoke insert, update, delete on public.notifications from authenticated, anon;
grant update (read_at) on public.notifications to authenticated;

-- Payments ---------------------------------------------------------------------

create function public.notify_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prefix text;
  v_what text;
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
    select receipt_prefix into v_prefix from public.gyms where id = new.gym_id;
    select coalesce(
      (select package_name from public.pt_subscriptions where id = new.pt_subscription_id),
      (select plan_name from public.subscriptions where id = new.subscription_id),
      (select name from public.plans where id = new.plan_id)
    ) into v_what;
    insert into public.notifications (gym_id, member_id, kind, data)
    values (new.gym_id, new.member_id, 'payment_paid', jsonb_build_object(
      'payment_id', new.id,
      'amount_paise', new.amount_paise,
      'receipt', coalesce(nullif(v_prefix, ''), '#') || new.receipt_no,
      'what', v_what,
      'method', new.method
    ));
  elsif new.status = 'failed' and tg_op = 'UPDATE' and old.status = 'created' then
    insert into public.notifications (gym_id, member_id, kind, data)
    values (new.gym_id, new.member_id, 'payment_rejected', jsonb_build_object(
      'payment_id', new.id,
      'amount_paise', new.amount_paise,
      'reason', new.note
    ));
  end if;
  return new;
end;
$$;

create trigger payments_notify
  after insert or update of status on public.payments
  for each row execute function public.notify_payment();

-- Classes: everyone booked or waitlisted when the gym cancels a class --------

create function public.notify_class_cancelled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' and new.starts_at > now() then
    insert into public.notifications (gym_id, member_id, kind, data)
    select new.gym_id, b.member_id, 'class_cancelled', jsonb_build_object(
      'session_id', new.id,
      'class_name', (select name from public.class_types where id = new.class_type_id),
      'starts_at', new.starts_at,
      'reason', new.cancel_reason
    )
    from public.class_bookings b
    where b.session_id = new.id and b.status in ('booked', 'waitlisted');
  end if;
  return new;
end;
$$;

create trigger class_sessions_notify_cancelled
  after update of status on public.class_sessions
  for each row execute function public.notify_class_cancelled();

-- Trainer's comment on the member's food log -----------------------------------

create function public.notify_nutrition_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.author_member_id is distinct from new.member_id then
    insert into public.notifications (gym_id, member_id, kind, data)
    values (new.gym_id, new.member_id, 'trainer_comment', jsonb_build_object(
      'day', new.day,
      'body', left(new.body, 140),
      'author', (select p.full_name from public.gym_members gm join public.profiles p on p.id = gm.user_id where gm.id = new.author_member_id)
    ));
  end if;
  return new;
end;
$$;

create trigger nutrition_comments_notify
  after insert on public.nutrition_comments
  for each row execute function public.notify_nutrition_comment();

-- New workout plan ---------------------------------------------------------------

create function public.notify_plan_assigned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (gym_id, member_id, kind, data)
  values (new.gym_id, new.member_id, 'plan_assigned', jsonb_build_object(
    'plan_name', (select name from public.workout_plans where id = new.plan_id),
    'author', (select p.full_name from public.gym_members gm join public.profiles p on p.id = gm.user_id where gm.id = new.assigned_by)
  ));
  return new;
end;
$$;

create trigger plan_assignments_notify
  after insert on public.plan_assignments
  for each row execute function public.notify_plan_assigned();

-- PT session logged ------------------------------------------------------------------

create function public.notify_pt_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.pt_subscriptions;
  v_used integer;
begin
  select * into v_sub from public.pt_subscriptions where id = new.pt_subscription_id;
  select count(*) into v_used from public.pt_sessions where pt_subscription_id = new.pt_subscription_id;
  insert into public.notifications (gym_id, member_id, kind, data)
  values (new.gym_id, v_sub.member_id, 'pt_session', jsonb_build_object(
    'package_name', v_sub.package_name,
    'session_on', new.session_on,
    'notes', new.notes,
    'sessions_left', case when v_sub.sessions_total is null then null else greatest(v_sub.sessions_total - v_used, 0) end
  ));
  return new;
end;
$$;

create trigger pt_sessions_notify
  after insert on public.pt_sessions
  for each row execute function public.notify_pt_session();

revoke execute on function public.notify_payment() from public, anon, authenticated;
revoke execute on function public.notify_class_cancelled() from public, anon, authenticated;
revoke execute on function public.notify_nutrition_comment() from public, anon, authenticated;
revoke execute on function public.notify_plan_assigned() from public, anon, authenticated;
revoke execute on function public.notify_pt_session() from public, anon, authenticated;

-- Deleting an account also deletes its notifications (they can name plans,
-- amounts and trainer comments).
create or replace function public.erase_personal_data(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_members uuid[];
begin
  select coalesce(array_agg(id), '{}') into v_members from public.gym_members where user_id = p_user_id;

  -- Health data: food, water, targets, body measurements, workouts.
  delete from public.food_logs where member_id = any (v_members);
  delete from public.water_logs where member_id = any (v_members);
  delete from public.nutrition_comments where member_id = any (v_members);
  delete from public.nutrition_targets where member_id = any (v_members);
  delete from public.nutrition_profiles where member_id = any (v_members);
  delete from public.body_metrics where member_id = any (v_members);
  delete from public.workout_logs where member_id = any (v_members);
  delete from public.plan_assignments where member_id = any (v_members);
  -- Staff notes about them, their notifications, and class spots they no longer need.
  delete from public.member_notes where member_id = any (v_members);
  delete from public.notifications where member_id = any (v_members);
  delete from public.class_bookings where member_id = any (v_members) and status in ('booked', 'waitlisted');

  update public.gym_members set status = 'inactive' where user_id = p_user_id;
  update public.profiles
    set full_name = 'Deleted member', phone = null, avatar_url = null, deleted_at = now()
    where id = p_user_id;
end;
$$;
revoke execute on function public.erase_personal_data(uuid) from public, anon, authenticated;
