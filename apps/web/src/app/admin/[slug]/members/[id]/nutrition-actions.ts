"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { requireGym, TEAM_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type TargetState = { error?: string; saved?: boolean } | undefined;

const targetSchema = z.object({
  slug: z.string(),
  member_id: z.uuid(),
  goal: z.enum(["lose", "maintain", "gain"]),
  kcal: z.coerce.number().int().min(800, "Calories must be at least 800").max(6000),
  protein_g: z.coerce.number().int().min(20, "Protein must be at least 20 g").max(400),
});

// Owners, admins and the member's PT trainer (RLS: can_coach).
export async function saveTargets(_prev: TargetState, formData: FormData): Promise<TargetState> {
  const parsed = targetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { slug, member_id, ...target } = parsed.data;
  const { gym, user } = await requireGym(slug, TEAM_ROLES);

  const supabase = await createClient();
  const { error } = await supabase.from("nutrition_targets").upsert({
    member_id,
    gym_id: gym.id,
    ...target,
    set_by: user.id,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.code === "42501" ? "Only the member's trainer, an owner or an admin can set targets." : error.message };
  revalidatePath(`/admin/${slug}/members/${member_id}`);
  return { saved: true };
}

export async function addNutritionComment(formData: FormData): Promise<ActionResult> {
  const { slug, member_id, day, body } = z
    .object({ slug: z.string(), member_id: z.uuid(), day: z.iso.date(), body: z.string().trim().min(1, "Write a comment").max(500) })
    .parse(Object.fromEntries(formData));
  const { gym, memberId } = await requireGym(slug, TEAM_ROLES);
  const supabase = await createClient();
  const { error } = await supabase
    .from("nutrition_comments")
    .insert({ gym_id: gym.id, member_id, day, body, author_member_id: memberId });
  if (error) return { error: error.message };
  revalidatePath(`/admin/${slug}/members/${member_id}`);
}

export async function deleteNutritionComment(formData: FormData): Promise<ActionResult> {
  const { slug, id, member_id } = z.object({ slug: z.string(), id: z.uuid(), member_id: z.uuid() }).parse(Object.fromEntries(formData));
  await requireGym(slug, TEAM_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.from("nutrition_comments").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/admin/${slug}/members/${member_id}`);
}
