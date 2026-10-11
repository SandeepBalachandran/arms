"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AVATAR_BUCKET } from "@gymos/shared";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ProfileState = { error?: string; saved?: boolean } | undefined;

const schema = z.object({
  full_name: z.string().trim().min(2, "Enter your name").max(80),
  phone: z.string().trim().max(20).transform((v) => v || null),
});

export async function updateProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in again." };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { saved: true };
}

export type DeleteAccountState = { error?: string } | undefined;

// "Delete my account": photo files, then the account and personal data (the
// delete_my_account function; gyms keep payments under "Deleted member").
// The member app does the same in lib/account.ts.
export async function deleteMyAccount(_prev: DeleteAccountState, formData: FormData): Promise<DeleteAccountState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in again." };
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") return { error: "Type DELETE to confirm" };

  const supabase = await createClient();
  // Owners delete their gym first (the database refuses too, but check
  // before the photo is removed).
  const { data: owned } = await supabase
    .from("gym_members")
    .select("gyms!inner(name, deleted_at)")
    .eq("user_id", user.id)
    .eq("role", "owner")
    .eq("status", "active")
    .is("gyms.deleted_at", null)
    .limit(1);
  if (owned?.length) return { error: `You own ${owned[0].gyms.name}. Delete the gym in Settings first, then delete your account.` };

  const { data: files } = await supabase.storage.from(AVATAR_BUCKET).list(user.id);
  if (files?.length) await supabase.storage.from(AVATAR_BUCKET).remove(files.map((f) => `${user.id}/${f.name}`));
  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { error: error.message };
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?deleted=1");
}
