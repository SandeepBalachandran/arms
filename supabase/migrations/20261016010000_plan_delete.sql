-- Owners/admins may delete a plan that was never sold; sold plans are hidden
-- instead so receipts and history keep their plan.
create policy "plans_delete" on public.plans for delete using (
  public.auth_role_in(gym_id) in ('owner', 'admin')
  and not exists (select 1 from public.subscriptions s where s.plan_id = plans.id)
  and not exists (select 1 from public.payments p where p.plan_id = plans.id)
);
