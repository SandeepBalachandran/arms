import type { Metadata } from "next";
import { formatDuration, formatMoney } from "@gymos/shared";
import { Badge, Card, PageHeader } from "@/components/ui";
import { requireGym, TEAM_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { togglePlan } from "./actions";
import { PlanForm } from "./plan-form";

export const metadata: Metadata = { title: "Plans" };

export default async function PlansPage({ params, searchParams }: PageProps<"/admin/[slug]/plans">) {
  const { slug } = await params;
  const { edit } = await searchParams;
  const { gym, role } = await requireGym(slug, TEAM_ROLES);
  const canEdit = role === "owner" || role === "admin";

  const supabase = await createClient();
  const { data: plans, error } = await supabase
    .from("plans")
    .select("*")
    .eq("gym_id", gym.id)
    .order("is_active", { ascending: false })
    .order("sort_order")
    .order("price_paise");
  if (error) throw error;

  const editing = typeof edit === "string" ? plans.find((p) => p.id === edit) : undefined;

  return (
    <>
      <PageHeader title="Plans" />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {plans.length === 0 && (
            <Card className="text-sm text-muted">No plans yet. Create your first membership plan.</Card>
          )}
          {plans.map((plan) => (
            <Card key={plan.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-medium">{plan.name}</h2>
                  {!plan.is_active && <Badge>Hidden</Badge>}
                </div>
                <p className="text-sm text-muted">
                  {formatMoney(plan.price_paise, gym.currency)} · {formatDuration(plan.duration_days)}
                  {plan.class_credits != null && ` · ${plan.class_credits} classes`}
                </p>
                {plan.description && <p className="mt-1 text-sm text-muted">{plan.description}</p>}
              </div>
              {canEdit && (
                <div className="flex gap-2 text-sm">
                  <a href={`?edit=${plan.id}`} className="rounded-lg border border-border px-3 py-1.5">Edit</a>
                  <form action={togglePlan}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="id" value={plan.id} />
                    <input type="hidden" name="is_active" value={plan.is_active ? "false" : "true"} />
                    <button className="rounded-lg border border-border px-3 py-1.5">
                      {plan.is_active ? "Hide" : "Show"}
                    </button>
                  </form>
                </div>
              )}
            </Card>
          ))}
        </div>

        {canEdit && (
          <Card className="h-fit">
            <h2 className="mb-4 font-medium">{editing ? `Edit ${editing.name}` : "New plan"}</h2>
            <PlanForm key={editing?.id ?? "new"} slug={slug} plan={editing} currency={gym.currency} />
          </Card>
        )}
      </div>
    </>
  );
}
