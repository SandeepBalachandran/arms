import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { requireGym, TEAM_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { GuideForm } from "../guide-form";
import { GuidePhotos } from "../guide-photos";

export const metadata: Metadata = { title: "Exercise guide" };

const MEASURE_LABELS = { weight_reps: "Weight × reps", reps: "Reps only", time: "Time" } as const;

// The how-to members see when they tap an exercise in the app: equipment
// photos, a video link and instructions in English and Malayalam.
export default async function ExerciseGuidePage({ params }: PageProps<"/admin/[slug]/workouts/exercises/[exerciseId]">) {
  const { slug, exerciseId } = await params;
  const { gym } = await requireGym(slug, TEAM_ROLES);
  if (!gym.workouts_enabled) notFound();

  const supabase = await createClient();
  const [exerciseRes, guideRes] = await Promise.all([
    supabase
      .from("exercises")
      .select("id, name, muscle_group, measure, gym_id")
      .eq("id", exerciseId)
      .or(`gym_id.is.null,gym_id.eq.${gym.id}`)
      .maybeSingle(),
    supabase
      .from("exercise_media")
      .select("photo_urls, video_url, how_to_en, how_to_ml, updated_at, editor:gym_members!exercise_media_updated_by_fkey(profiles!inner(full_name))")
      .eq("gym_id", gym.id)
      .eq("exercise_id", exerciseId)
      .maybeSingle(),
  ]);
  if (exerciseRes.error) throw exerciseRes.error;
  if (guideRes.error) throw guideRes.error;
  const exercise = exerciseRes.data;
  if (!exercise) notFound();
  const guide = guideRes.data;

  return (
    <>
      <Link href={`/admin/${slug}/workouts`} className="text-sm text-muted hover:underline">← Workouts</Link>
      <PageHeader title={exercise.name} />
      <p className="-mt-4 mb-6 text-sm text-muted">
        {exercise.muscle_group} · {MEASURE_LABELS[exercise.measure]} · {exercise.gym_id ? "your exercise" : "built-in"}
        {guide && (
          <> · guide updated {new Date(guide.updated_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: gym.timezone })}
            {guide.editor?.profiles.full_name && ` by ${guide.editor.profiles.full_name}`}</>
        )}
      </p>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <h2 className="mb-3 font-medium">Photos</h2>
          <GuidePhotos slug={slug} exerciseId={exercise.id} exerciseName={exercise.name} photos={guide?.photo_urls ?? []} />
        </Card>
        <Card>
          <h2 className="mb-3 font-medium">Video and instructions</h2>
          <GuideForm slug={slug} exerciseId={exercise.id} initial={guide} />
        </Card>
      </div>
      <p className="mt-4 text-xs text-muted">Members see this guide when they tap {exercise.name} in their plan or while logging a workout.</p>
    </>
  );
}
