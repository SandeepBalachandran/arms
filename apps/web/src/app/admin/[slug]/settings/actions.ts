"use server";

import { revalidatePath } from "next/cache";
import {
  checkinSettingsSchema,
  classSettingsSchema,
  generalSettingsSchema,
  hoursSettingsSchema,
  membershipSettingsSchema,
  nutritionSettingsSchema,
  posterCheckinSettingsSchema,
  ptSettingsSchema,
  upiIdSchema,
  workoutSettingsSchema,
} from "@gymos/shared";
import { z } from "zod";
import { requireGym, TEAM_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type SettingsState = { error?: string; saved?: boolean } | undefined;

const upiSettingsSchema = z
  .object({
    upi_id: z.union([z.literal(""), upiIdSchema]).transform((v) => v || null),
    upi_payee_name: z.string().trim().max(80).transform((v) => v || null),
  })
  .refine((v) => !v.upi_id || (v.upi_payee_name?.length ?? 0) >= 2, "Enter the name shown on your UPI account");

const SECTIONS = {
  general: generalSettingsSchema,
  memberships: membershipSettingsSchema,
  upi: upiSettingsSchema,
  checkin: checkinSettingsSchema,
  poster: posterCheckinSettingsSchema,
  classes: classSettingsSchema,
  workouts: workoutSettingsSchema,
  pt: ptSettingsSchema,
  nutrition: nutritionSettingsSchema,
  hours: hoursSettingsSchema,
};

export type SettingsSection = keyof typeof SECTIONS;

// One action for every settings section; each section validates only its own
// columns on public.gyms.
export async function saveSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const slug = String(formData.get("slug"));
  const section = String(formData.get("section")) as SettingsSection;
  const schema = SECTIONS[section];
  if (!schema) return { error: "Unknown settings section" };

  const parsed = schema.safeParse({
    ...Object.fromEntries(formData),
    manual_payment_methods: formData.getAll("manual_payment_methods"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // The database checks each changed column: sections need manage_sections,
  // everything else edit_gym_settings (see protect_gym_columns).
  const { gym, can } = await requireGym(slug, TEAM_ROLES);
  if (!can("edit_gym_settings") && !can("manage_sections")) return { error: "Ask the owner for access to settings" };
  const supabase = await createClient();
  const { error } = await supabase.from("gyms").update(parsed.data).eq("id", gym.id);
  if (error) return { error: error.message };

  revalidatePath(`/admin/${slug}`, "layout");
  return { saved: true };
}
