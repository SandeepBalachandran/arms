"use server";

import { revalidatePath } from "next/cache";
import { rupeesSchema } from "@gymos/shared";
import { z } from "zod";
import { requireGym } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type PlanState = { error?: string; saved?: boolean } | undefined;

const optionalInt = (max: number) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= max), "Enter a whole number");

const planSchema = z.object({
  slug: z.string(),
  id: z.string().optional(),
  name: z.string().trim().min(2, "Name is too short").max(60),
  description: z.string().trim().max(300).transform((v) => v || null),
  price: rupeesSchema,
  duration_days: z.coerce.number().int().min(1, "Duration must be at least 1 day").max(3660),
  class_credits: optionalInt(10000),
  sort_order: optionalInt(1000).transform((v) => v ?? 0),
});

export async function savePlan(_prev: PlanState, formData: FormData): Promise<PlanState> {
  const parsed = planSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { slug, id, price, ...values } = parsed.data;
  const { gym } = await requireGym(slug, ["owner", "admin"]);

  const supabase = await createClient();
  const row = { ...values, price_paise: price };
  const { error } = id
    ? await supabase.from("plans").update(row).eq("id", id).eq("gym_id", gym.id)
    : await supabase.from("plans").insert({ ...row, gym_id: gym.id });
  if (error) return { error: error.message };

  revalidatePath(`/admin/${slug}/plans`);
  return { saved: true };
}

export async function togglePlan(formData: FormData) {
  const { slug, id, is_active } = z
    .object({ slug: z.string(), id: z.uuid(), is_active: z.enum(["true", "false"]) })
    .parse(Object.fromEntries(formData));
  const { gym } = await requireGym(slug, ["owner", "admin"]);

  const supabase = await createClient();
  const { error } = await supabase
    .from("plans")
    .update({ is_active: is_active === "true" })
    .eq("id", id)
    .eq("gym_id", gym.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/${slug}/plans`);
}

// Only plans that were never sold can be deleted (RLS enforces this too).
export async function deletePlan(formData: FormData) {
  const { slug, id } = z.object({ slug: z.string(), id: z.uuid() }).parse(Object.fromEntries(formData));
  const { gym } = await requireGym(slug, ["owner", "admin"]);

  const supabase = await createClient();
  const { error } = await supabase.from("plans").delete().eq("id", id).eq("gym_id", gym.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/${slug}/plans`);
}
