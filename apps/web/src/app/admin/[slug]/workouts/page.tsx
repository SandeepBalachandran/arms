import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { requireGym, TEAM_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { setExerciseHidden } from "./actions";
import { NewExerciseForm, NewPlanForm } from "./forms";

export const metadata: Metadata = { title: "Workouts" };

export default async function WorkoutsPage({ params }: PageProps<"/admin/[slug]/workouts">) {
  const { slug } = await params;
  const { gym } = await requireGym(slug, TEAM_ROLES);
  if (!gym.workouts_enabled) notFound();

  const supabase = await createClient();
  const [plans, library, hidden] = await Promise.all([
    supabase
      .from("workout_plans")
      .select("id, name, description, workout_plan_items(count), plan_assignments(count)")
      .eq("gym_id", gym.id)
      .eq("is_archived", false)
      .order("created_at", { ascending: false }),
    supabase
      .from("exercises")
      .select("id, name, muscle_group, gym_id")
      .or(`gym_id.is.null,gym_id.eq.${gym.id}`)
      .order("muscle_group")
      .order("name"),
    supabase.from("gym_hidden_exercises").select("exercise_id").eq("gym_id", gym.id),
  ]);
  if (plans.error) throw plans.error;
  if (library.error) throw library.error;
  if (hidden.error) throw hidden.error;
  const hiddenIds = new Set(hidden.data.map((h) => h.exercise_id));
  const byGroup = Map.groupBy(library.data, (e) => e.muscle_group);

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
              Built-in exercises plus your own. Hidden ones don&apos;t appear in plans or the member app.
            </p>
            <div className="mb-4 max-h-80 space-y-3 overflow-y-auto pr-1">
              {[...byGroup].map(([group, exercises]) => (
                <div key={group}>
                  <p className="text-xs font-medium uppercase text-muted">{group}</p>
                  <ul>
                    {exercises.map((e) => {
                      const isHidden = hiddenIds.has(e.id);
                      return (
                        <li key={e.id} className="flex items-center justify-between py-0.5 text-sm">
                          <span className={isHidden ? "text-muted line-through" : ""}>
                            {e.name}
                            {e.gym_id && <span className="ml-1 text-xs text-brand">yours</span>}
                          </span>
                          <form action={setExerciseHidden}>
                            <input type="hidden" name="slug" value={slug} />
                            <input type="hidden" name="exercise_id" value={e.id} />
                            <input type="hidden" name="hidden" value={isHidden ? "false" : "true"} />
                            <button className="text-xs text-muted hover:text-foreground">{isHidden ? "Show" : "Hide"}</button>
                          </form>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
            <NewExerciseForm slug={slug} />
          </Card>
        </div>
      </div>
    </>
  );
}
