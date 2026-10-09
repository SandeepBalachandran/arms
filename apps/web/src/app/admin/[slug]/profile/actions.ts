"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type PasswordState = { error?: string; saved?: boolean } | undefined;

// Set or change the signed-in user's password (accounts created with an email
// code have none until they set one here).
export async function changePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  if (!(await getCurrentUser())) return { error: "Please sign in again." };
  const parsed = z
    .object({
      password: z.string().min(8, "Use at least 8 characters").max(72),
      confirm: z.string(),
    })
    .refine((v) => v.password === v.confirm, "The passwords don't match")
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };
  return { saved: true };
}

// Signs out on every device (phones and browsers).
export async function signOutEverywhere() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login");
}
