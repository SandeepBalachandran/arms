"use server";

import { revalidatePath } from "next/cache";
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
