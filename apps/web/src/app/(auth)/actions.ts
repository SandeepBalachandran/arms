"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNextPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// `sent` switches the form to a "check your email" screen.
export type AuthState = { error?: string; sent?: "confirm" | "link" } | undefined;

// Supabase's messages are written for developers; show people something plainer.
function friendly(message: string) {
  if (/invalid login credentials/i.test(message)) return "That email and password don't match. Try again or use an email link.";
  if (/email not confirmed/i.test(message)) return "Confirm your email first: open the link we sent you.";
  if (/already registered|already been registered/i.test(message)) return "There's already an account with this email. Sign in instead.";
  if (/rate limit|too many|security purposes/i.test(message)) return "Too many tries. Wait a minute and try again.";
  return message;
}

const credentials = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: friendly(error.message) };

  redirect(safeNextPath(formData.get("next") as string, "/admin"));
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials
    .extend({ full_name: z.string().trim().min(2, "Enter your name") })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const next = safeNextPath(formData.get("next") as string, "/admin");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { error: friendly(error.message) };
  if (!data.session) return { sent: "confirm" };

  redirect(next);
}

export async function sendMagicLink(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = z.email().safeParse(formData.get("email"));
  if (!email.success) return { error: "Enter a valid email" };

  const next = safeNextPath(formData.get("next") as string, "/admin");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { error: friendly(error.message) };
  return { sent: "link" };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
