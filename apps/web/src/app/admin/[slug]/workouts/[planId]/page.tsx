import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { groupPlanDays } from "@gymos/shared";
import { Card, PageHeader, Select } from "@/components/ui";
import { requireGym, TEAM_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { archivePlan, assignPlan, removePlanItem, unassignPlan } from "../actions";
import { AddItemForm } from "../forms";

export const metadata: Metadata = { title: "Workout plan" };

export default async function PlanPage({ params }: PageProps<"/admin/[slug]/workouts/[planId]">) {
  const { slug, planId } = await params;
  const { gym } = await requireGym(slug, TEAM_ROLES);
  if (!gym.workouts_enabled) notFound();

  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("workout_plans")
    .select("id, name, description")
    .eq("id", planId)
    .eq("gym_id", gym.id)
    .maybeSingle();
  if (!plan) notFound();

  const [items, exercises, assignments, members, hidden] = await Promise.all([
    supabase
      .from("workout_plan_items")
      .select("id, day_label, position, sets, reps, rest_sec, notes, exercises(name)")
      .eq("plan_id", planId),
    supabase
      .from("exercises")
      .select("id, name, muscle_group")
      .or(`gym_id.is.null,gym_id.eq.${gym.id}`)
      .eq("is_active", true)
      .order("muscle_group")
      .order("name"),
    supabase
      .from("plan_assignments")
      .select("id, member_id, gym_members!plan_assignments_member_id_fkey!inner(profiles!inner(full_name))")
      .eq("plan_id", planId),
    supabase
      .from("gym_members")
      .select("id, profiles!inner(full_name)")
      .eq("gym_id", gym.id)
      .eq("role", "member")
      .eq("status", "active")
      .order("joined_at", { ascending: false })
      .limit(500),
    supabase.from("gym_hidden_exercises").select("exercise_id").eq("gym_id", gym.id),
  ]);
  if (hidden.error) throw hidden.error;
  const hiddenIds = new Set(hidden.data.map((h) => h.exercise_id));
  if (items.error) throw items.error;
  if (exercises.error) throw exercises.error;
  if (assignments.error) throw assignments.error;
  if (members.error) throw members.error;

  const days = groupPlanDays(items.data);
  const assignedIds = new Set(assignments.data.map((a) => a.member_id));
  const assignable = members.data.filter((m) => !assignedIds.has(m.id));

  return (
    <>
      <Link href={`/admin/${slug}/workouts`} className="text-sm text-muted hover:underline">← Workouts</Link>
      <PageHeader
        title={plan.name}
        actions={
          <form action={archivePlan}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="id" value={planId} />
            <button className="text-sm text-muted hover:text-danger">Archive plan</button>
          </form>
        }
      />
      {plan.description && <p className="-mt-4 mb-6 text-sm text-muted">{plan.description}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {days.length === 0 && <Card className="text-sm text-muted">Add the first exercise on the right.</Card>}
          {days.map((day) => (
            <Card key={day.label} className="p-0">
              <h2 className="border-b border-border p-3 font-medium">{day.label}</h2>
              <ol className="divide-y divide-border text-sm">
                {day.items.map((item, i) => (
                  <li key={item.id} className="flex items-center justify-between gap-2 p-3">
                    <div>
                      <p className="font-medium">{i + 1}. {item.exercises.name}</p>
                      <p className="text-muted">
                        {item.sets} × {item.reps}
                        {item.rest_sec != null && ` · rest ${item.rest_sec}s`}
                        {item.notes && ` · ${item.notes}`}
                      </p>
                    </div>
                    <form action={removePlanItem}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="plan_id" value={planId} />
                      <input type="hidden" name="id" value={item.id} />
                      <button className="text-xs text-muted hover:text-danger">Remove</button>
                    </form>
                  </li>
                ))}
              </ol>
            </Card>
          ))}
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-medium">Add exercise</h2>
            <AddItemForm slug={slug} planId={planId} days={days.map((d) => d.label)} exercises={exercises.data.filter((e) => !hiddenIds.has(e.id))} />
          </Card>
          <Card>
            <h2 className="mb-2 font-medium">Assigned to</h2>
            <ul className="mb-3 divide-y divide-border text-sm">
              {assignments.data.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2">
                  <Link href={`/admin/${slug}/members/${a.member_id}`} className="hover:underline">
                    {a.gym_members.profiles.full_name || "Unnamed member"}
                  </Link>
                  <form action={unassignPlan}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="id" value={a.id} />
                    <button className="text-xs text-muted hover:text-danger">Remove</button>
                  </form>
                </li>
              ))}
              {assignments.data.length === 0 && <li className="py-2 text-muted">No one yet.</li>}
            </ul>
            {assignable.length > 0 && (
              <form action={assignPlan} className="flex gap-2">
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="plan_id" value={planId} />
                <Select name="member_id" required>
                  {assignable.map((m) => (
                    <option key={m.id} value={m.id}>{m.profiles.full_name || "Unnamed member"}</option>
                  ))}
                </Select>
                <button className="shrink-0 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-fg">Assign</button>
              </form>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
