"use server";

import { redirect } from "next/navigation";
import { gymSlugSchema } from "@gymos/shared";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type RegisterState = { error?: string } | undefined;

const schema = z.object({
  name: z.string().trim().min(2, "Gym name is too short").max(80),
  slug: gymSlugSchema,
});

export async function registerGym(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  if (!(await getCurrentUser())) return { error: "Please sign in again." };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("register_gym", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    // Timezone, currency etc. start at the defaults (India) and are changed in Settings.
  });
  if (error) {
    return { error: error.code === "23505" ? "That link is taken. Try another." : error.message };
  }

  redirect(`/admin/${parsed.data.slug}`);
}

export type SlugCheck = { status: "available" | "taken" | "invalid"; message?: string; suggestions: string[] };

// Live check while the owner types a gym code. Codes are unique across GOS
// (deleted gyms keep theirs for 30 days), so a taken code comes back with
// free alternatives to tap.
export async function checkSlug(input: string): Promise<SlugCheck> {
  if (!(await getCurrentUser())) return { status: "invalid", message: "Please sign in again.", suggestions: [] };
  const parsed = gymSlugSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid", message: parsed.error.issues[0].message, suggestions: [] };
  const slug = parsed.data;

  const base = slug.slice(0, 34);
  const candidates = [
    slug,
    ...(/(gym|fitness)$/.test(base) ? [] : [`${base}-gym`, `${base}-fitness`]),
    ...[2, 3, 4, 5].map((n) => `${base}-${n}`),
  ];
  const supabase = await createClient();
  const { data, error } = await supabase.from("gyms").select("slug").in("slug", candidates);
  if (error) return { status: "invalid", message: error.message, suggestions: [] };
  const taken = new Set(data.map((g) => g.slug));

  if (!taken.has(slug)) return { status: "available", suggestions: [] };
  return { status: "taken", suggestions: candidates.slice(1).filter((c) => !taken.has(c)).slice(0, 3) };
}
