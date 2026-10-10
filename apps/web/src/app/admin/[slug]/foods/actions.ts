"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { requireGym, TEAM_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type FoodState = { error?: string; saved?: boolean } | undefined;

const amount = (max: number) => z.coerce.number().min(0).max(max);
const foodSchema = z.object({
  slug: z.string(),
  name: z.string().trim().min(2, "Enter the food's name").max(80),
  name_ml: z.string().trim().max(80).transform((v) => v || null),
  serving_label: z.string().trim().min(1, "Enter the portion, e.g. 1 piece").max(40),
  kcal: z.coerce.number().int().min(0).max(3000),
  protein_g: amount(300),
  carbs_g: amount(500),
  fat_g: amount(300),
  food_type: z.enum(["veg", "egg", "nonveg"]),
  category: z.string().trim().max(30).transform((v) => v || "other"),
});

// Trainers and staff add foods their members eat that aren't in the built-in list.
export async function addFood(_prev: FoodState, formData: FormData): Promise<FoodState> {
  const parsed = foodSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { slug, ...food } = parsed.data;
  const { gym } = await requireGym(slug, TEAM_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.from("foods").insert({ ...food, gym_id: gym.id });
  if (error) return { error: error.message };
  revalidatePath(`/admin/${slug}/foods`);
  return { saved: true };
}

export async function setFoodActive(formData: FormData): Promise<ActionResult> {
  const { slug, id, active } = z
    .object({ slug: z.string(), id: z.uuid(), active: z.enum(["true", "false"]) })
    .parse(Object.fromEntries(formData));
  const { gym } = await requireGym(slug, TEAM_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.from("foods").update({ is_active: active === "true" }).eq("id", id).eq("gym_id", gym.id);
  if (error) return { error: error.message };
  revalidatePath(`/admin/${slug}/foods`);
}
