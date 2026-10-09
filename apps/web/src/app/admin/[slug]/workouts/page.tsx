import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { requireGym, TEAM_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NewExerciseForm, NewPlanForm } from "./forms";

export const metadata: Metadata = { title: "Workouts" };

export default async function WorkoutsPage({ params }: PageProps<"/admin/[slug]/workouts">) {
  const { slug } = await params;
  const { gym } = await requireGym(slug, TEAM_ROLES);
  if (!gym.workouts_enabled) notFound();

  const supabase = await createClient();
  const [plans, customExercises] = await Promise.all([
    supabase
      .from("workout_plans")
      .select("id, name, description, workout_plan_items(count), plan_assignments(count)")
      .eq("gym_id", gym.id)
      .eq("is_archived", false)
      .order("created_at", { ascending: false }),
    supabase.from("exercises").select("id, name, muscle_group").eq("gym_id", gym.id).order("name"),
  ]);
  if (plans.error) throw plans.error;
  if (customExercises.error) throw customExercises.error;

  return (
    <>
      <PageHeader title="Workouts" />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          <h2 className="font-medium">Plans</h2>
          {plans.data.length === 0 && (
            <Card className="text-sm text-muted">No plans yet. Create one and assign it to members.</Card>
          )}
          {plans.data.map((p) => (
            <Link key={p.id} href={`/admin/${slug}/workouts/${p.id}`} className="block">
              <Card className="hover:border-brand">
                <p className="font-medium">{p.name}</p>
                {p.description && <p className="text-sm text-muted">{p.description}</p>}
                <p className="mt-1 text-xs text-muted">
                  {p.workout_plan_items[0]?.count ?? 0} exercises · assigned to {p.plan_assignments[0]?.count ?? 0}
                </p>
              </Card>
            </Link>
          ))}
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-medium">New plan</h2>
            <NewPlanForm slug={slug} />
          </Card>
          <Card>
            <h2 className="mb-1 font-medium">Exercise library</h2>
            <p className="mb-3 text-sm text-muted">
              40 common exercises are built in.
              {customExercises.data.length > 0 &&
                ` Your own: ${customExercises.data.map((e) => e.name).join(", ")}.`}
            </p>
            <NewExerciseForm slug={slug} />
          </Card>
        </div>
      </div>
    </>
  );
}
