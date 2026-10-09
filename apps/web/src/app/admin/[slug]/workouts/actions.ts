"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireGym, TEAM_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Trainers and staff (the whole team) manage plans; RLS enforces the same.

export type FormState = { error?: string; message?: string } | undefined;

export async function createPlan(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({
      slug: z.string(),
      name: z.string().trim().min(2, "Name is too short").max(60),
      description: z.string().trim().max(500).transform((v) => v || null),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { slug, ...values } = parsed.data;
  const { gym, memberId } = await requireGym(slug, TEAM_ROLES);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_plans")
    .insert({ ...values, gym_id: gym.id, created_by: memberId })
    .select("id")
    .single();
  if (error) return { error: error.message };
  redirect(`/admin/${slug}/workouts/${data.id}`);
}

export async function createExercise(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({
      slug: z.string(),
      name: z.string().trim().min(2, "Name is too short").max(60),
      muscle_group: z.string().trim().min(2, "Enter a muscle group").max(30),
      measure: z.enum(["weight_reps", "reps", "time"]),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { slug, ...values } = parsed.data;
  const { gym } = await requireGym(slug, TEAM_ROLES);

  const supabase = await createClient();
  const { error } = await supabase.from("exercises").insert({ ...values, gym_id: gym.id });
  if (error) return { error: error.message };
  revalidatePath(`/admin/${slug}/workouts`, "layout");
  return { message: `Added ${values.name}.` };
}

const itemSchema = z.object({
  slug: z.string(),
  plan_id: z.uuid(),
  day_label: z.string().trim().min(1, "Enter a day, e.g. Day A").max(40),
  exercise_id: z.uuid("Choose an exercise"),
  sets: z.coerce.number().int().min(1).max(20),
  reps: z.string().trim().min(1, "Enter reps, e.g. 8-12").max(20),
  rest_sec: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 900), "Rest is 0–900 seconds"),
  notes: z.string().trim().max(200).transform((v) => v || null),
});

export async function addPlanItem(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = itemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { slug, ...item } = parsed.data;
  await requireGym(slug, TEAM_ROLES);

  const supabase = await createClient();
  const { count } = await supabase
    .from("workout_plan_items")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", item.plan_id);
  const { error } = await supabase.from("workout_plan_items").insert({ ...item, position: count ?? 0 });
  if (error) return { error: error.message };
  revalidatePath(`/admin/${slug}/workouts/${item.plan_id}`);
  return { message: "Added." };
}

export async function removePlanItem(formData: FormData) {
  const { slug, plan_id, id } = z
    .object({ slug: z.string(), plan_id: z.uuid(), id: z.uuid() })
    .parse(Object.fromEntries(formData));
  await requireGym(slug, TEAM_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.from("workout_plan_items").delete().eq("id", id).eq("plan_id", plan_id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/${slug}/workouts/${plan_id}`);
}

export async function assignPlan(formData: FormData) {
  const { slug, plan_id, member_id } = z
    .object({ slug: z.string(), plan_id: z.uuid(), member_id: z.uuid() })
    .parse(Object.fromEntries(formData));
  const { gym, memberId } = await requireGym(slug, TEAM_ROLES);
  const supabase = await createClient();
  const { error } = await supabase
    .from("plan_assignments")
    .upsert({ gym_id: gym.id, plan_id, member_id, assigned_by: memberId }, { onConflict: "plan_id,member_id" });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/${slug}`, "layout");
}

export async function unassignPlan(formData: FormData) {
  const { slug, id } = z.object({ slug: z.string(), id: z.uuid() }).parse(Object.fromEntries(formData));
  const { gym } = await requireGym(slug, TEAM_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.from("plan_assignments").delete().eq("id", id).eq("gym_id", gym.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/${slug}`, "layout");
}

export async function archivePlan(formData: FormData) {
  const { slug, id } = z.object({ slug: z.string(), id: z.uuid() }).parse(Object.fromEntries(formData));
  const { gym } = await requireGym(slug, TEAM_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.from("workout_plans").update({ is_archived: true }).eq("id", id).eq("gym_id", gym.id);
  if (error) throw new Error(error.message);
  redirect(`/admin/${slug}/workouts`);
}

// Show or hide a built-in exercise for this gym (Workouts → Exercise library).
export async function setExerciseHidden(formData: FormData) {
  const { slug, exercise_id, hidden } = z
    .object({ slug: z.string(), exercise_id: z.uuid(), hidden: z.enum(["true", "false"]) })
    .parse(Object.fromEntries(formData));
  const { gym } = await requireGym(slug, TEAM_ROLES);
  const supabase = await createClient();
  const { error } =
    hidden === "true"
      ? await supabase.from("gym_hidden_exercises").upsert({ gym_id: gym.id, exercise_id })
      : await supabase.from("gym_hidden_exercises").delete().eq("gym_id", gym.id).eq("exercise_id", exercise_id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/${slug}/workouts`, "layout");
}
