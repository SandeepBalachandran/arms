"use server";

import { revalidatePath } from "next/cache";
import { upiIdSchema } from "@gymos/shared";
import { z } from "zod";
import { requireGym } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type SettingsState = { error?: string; saved?: boolean } | undefined;

const schema = z.object({
  slug: z.string(),
  name: z.string().trim().min(2).max(80),
  address: z.string().trim().max(200).transform((v) => v || null),
  phone: z.string().trim().max(20).transform((v) => v || null),
  timezone: z.string().refine((tz) => Intl.supportedValuesOf("timeZone").includes(tz), "Unknown timezone"),
});

export async function updateGym(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { slug, ...values } = parsed.data;
  const { gym } = await requireGym(slug, ["owner", "admin"]);

  const supabase = await createClient();
  const { error } = await supabase.from("gyms").update(values).eq("id", gym.id);
  if (error) return { error: error.message };

  revalidatePath(`/admin/${slug}`, "layout");
  return { saved: true };
}

const upiSchema = z.object({
  slug: z.string(),
  upi_id: z.union([z.literal(""), upiIdSchema]).transform((v) => v || null),
  upi_payee_name: z.string().trim().max(80).transform((v) => v || null),
});

// Members pay this UPI ID from the app; empty turns in-app UPI off.
export async function updateUpi(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const parsed = upiSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { slug, upi_id, upi_payee_name } = parsed.data;
  const { gym } = await requireGym(slug, ["owner", "admin"]);
  if (upi_id && (!upi_payee_name || upi_payee_name.length < 2)) {
    return { error: "Enter the name shown on your UPI account" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("gyms").update({ upi_id, upi_payee_name }).eq("id", gym.id);
  if (error) return { error: error.message };

  revalidatePath(`/admin/${slug}`, "layout");
  return { saved: true };
}

export async function updateCheckin(formData: FormData) {
  const { slug, enabled } = z
    .object({ slug: z.string(), enabled: z.enum(["true", "false"]) })
    .parse(Object.fromEntries(formData));
  const { gym } = await requireGym(slug, ["owner", "admin"]);

  const supabase = await createClient();
  const { error } = await supabase
    .from("gyms")
    .update({ checkin_enabled: enabled === "true" })
    .eq("id", gym.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/${slug}`, "layout");
}
