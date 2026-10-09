import type { Metadata } from "next";
import { formatDuration, formatMoney, todayIn, type Plan } from "@gymos/shared";
import { CreditCard, EyeOff, Users } from "lucide-react";
import { Badge, Card, PageHeader } from "@/components/ui";
import { requireGym, TEAM_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deletePlan, togglePlan } from "./actions";
import { PlanDialog } from "./plan-form";

export const metadata: Metadata = { title: "Plans" };

type Stats = { active: number; sold: number };

export default async function PlansPage({ params }: PageProps<"/admin/[slug]/plans">) {
  const { slug } = await params;
  const { gym, role } = await requireGym(slug, TEAM_ROLES);
  const canEdit = role === "owner" || role === "admin";

  const supabase = await createClient();
  const [plans, subs] = await Promise.all([
    supabase.from("plans").select("*").eq("gym_id", gym.id).order("sort_order").order("price_paise"),
    supabase.from("subscriptions").select("plan_id, status, starts_on, ends_on").eq("gym_id", gym.id).not("plan_id", "is", null),
  ]);
  if (plans.error) throw plans.error;
  if (subs.error) throw subs.error;

  // Members currently on each plan, and how many times it was sold.
  const today = todayIn(gym.timezone);
  const stats = new Map<string, Stats>();
  for (const s of subs.data) {
    const st = stats.get(s.plan_id!) ?? { active: 0, sold: 0 };
    st.sold += 1;
    if (s.status === "active" && s.starts_on <= today && s.ends_on >= today) st.active += 1;
    stats.set(s.plan_id!, st);
  }

  const visible = plans.data.filter((p) => p.is_active);
  const hidden = plans.data.filter((p) => !p.is_active);
  const cardProps = { slug, currency: gym.currency, canEdit };

  return (
    <>
      <PageHeader title="Plans" actions={canEdit && <PlanDialog slug={slug} currency={gym.currency} />} />

      {plans.data.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-12 text-center">
          <CreditCard className="size-8 text-brand" />
          <p className="font-medium">No plans yet</p>
          <p className="max-w-sm text-sm text-muted">
            Plans are what members buy: a price and how long it lasts, e.g. Monthly {formatMoney(149900, gym.currency)} or
            Quarterly {formatMoney(399900, gym.currency)}.
          </p>
          {canEdit && <PlanDialog slug={slug} currency={gym.currency} />}
        </Card>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted">
            Members see these plans in the app. Price changes apply to new purchases; existing memberships keep the price they were sold at.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((p) => <PlanCard key={p.id} plan={p} stats={stats.get(p.id)} {...cardProps} />)}
          </div>
          {hidden.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-1 flex items-center gap-2 font-medium text-muted">
                <EyeOff className="size-4" /> Hidden plans
              </h2>
              <p className="mb-4 text-sm text-muted">Not shown in the app or at the front desk. Existing members keep them until they expire.</p>
              <div className="grid gap-4 opacity-70 sm:grid-cols-2 xl:grid-cols-3">
                {hidden.map((p) => <PlanCard key={p.id} plan={p} stats={stats.get(p.id)} {...cardProps} />)}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}

function PlanCard({ plan, stats, slug, currency, canEdit }: {
  plan: Plan;
  stats?: Stats;
  slug: string;
  currency: string;
  canEdit: boolean;
}) {
  const perMonth = plan.duration_days >= 60 ? Math.round((plan.price_paise * 30) / plan.duration_days) : null;
  const sold = stats?.sold ?? 0;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-lg font-semibold">{plan.name}</h2>
        {!plan.is_active && <Badge>Hidden</Badge>}
      </div>
      <div>
        <p className="text-3xl font-bold tabular-nums">{formatMoney(plan.price_paise, currency)}</p>
        <p className="text-sm text-muted">
          for {formatDuration(plan.duration_days)}
          {perMonth && ` · ${formatMoney(perMonth, currency)}/month`}
        </p>
      </div>
      <ul className="space-y-1 text-sm">
        <li>{plan.class_credits == null ? "Unlimited classes" : `${plan.class_credits} classes included`}</li>
        {plan.description && <li className="text-muted">{plan.description}</li>}
      </ul>
      <p className="flex items-center gap-1.5 text-sm text-muted">
        <Users className="size-4" />
        {stats?.active ?? 0} active {stats?.active === 1 ? "member" : "members"} · sold {sold} {sold === 1 ? "time" : "times"}
      </p>
      {canEdit && (
        <div className="mt-auto flex flex-wrap gap-2 border-t border-border pt-3">
          <PlanDialog slug={slug} currency={currency} plan={plan} />
          <form action={togglePlan}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="id" value={plan.id} />
            <input type="hidden" name="is_active" value={plan.is_active ? "false" : "true"} />
            <button className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-border/40">
              {plan.is_active ? "Hide" : "Show"}
            </button>
          </form>
          {sold === 0 && (
            <form action={deletePlan} className="ml-auto">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="id" value={plan.id} />
              <button className="rounded-lg px-3 py-1.5 text-sm text-danger hover:bg-danger/10">Delete</button>
            </form>
          )}
        </div>
      )}
    </Card>
  );
}
