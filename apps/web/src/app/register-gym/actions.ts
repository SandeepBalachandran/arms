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
  timezone: z.string().min(1),
});

export async function registerGym(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  if (!(await getCurrentUser())) return { error: "Please sign in again." };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("register_gym", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_timezone: parsed.data.timezone,
  });
  if (error) {
    return { error: error.code === "23505" ? "That link is taken. Try another." : error.message };
  }

  redirect(`/admin/${parsed.data.slug}`);
}
