"use server";

import { revalidatePath } from "next/cache";
import { AVATAR_BUCKET, AVATAR_MAX_BYTES, AVATAR_TYPES, avatarPath } from "@gymos/shared";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { requireGym, STAFF_ROLES, TEAM_ROLES } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Whose photo is being changed. Everyone on the team can change their own.
// The front desk (owner, admin, staff) can also set a member's photo, for
// people who don't use the app; never another team member's.
async function target(formData: FormData) {
  const { slug, member_id } = z
    .object({ slug: z.string(), member_id: z.uuid().optional() })
    .parse({ slug: formData.get("slug"), member_id: formData.get("member_id") || undefined });
  const { user, role, gym } = await requireGym(slug, TEAM_ROLES);
  if (!member_id) return { slug, userId: user.id, self: true as const };

  if (!STAFF_ROLES.includes(role)) return { error: "Only the front desk can change a member's photo" };
  const supabase = await createClient();
  const { data: member } = await supabase
    .from("gym_members")
    .select("user_id, role")
    .eq("id", member_id)
    .eq("gym_id", gym.id)
    .maybeSingle();
  if (!member) return { error: "Member not found" };
  if (member.user_id === user.id) return { slug, userId: user.id, self: true as const };
  if (member.role !== "member") return { error: "Team members set their own photo" };
  return { slug, userId: member.user_id, self: false as const };
}

// Saves the new path: your own through RLS, a member's with the service key
// (after the role check above). Then removes the old file.
async function setPath(t: { userId: string; self: boolean }, path: string | null): Promise<ActionResult> {
  const admin = createAdminClient();
  const { data: before } = await admin.from("profiles").select("avatar_url").eq("id", t.userId).single();
  const client = t.self ? await createClient() : admin;
  const { error } = await client.from("profiles").update({ avatar_url: path }).eq("id", t.userId);
  if (error) return { error: error.message };
  if (before?.avatar_url && before.avatar_url !== path) await admin.storage.from(AVATAR_BUCKET).remove([before.avatar_url]);
}

export async function uploadAvatar(formData: FormData): Promise<ActionResult> {
  const t = await target(formData);
  if ("error" in t) return { error: t.error };
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo" };
  const ext = AVATAR_TYPES[file.type];
  if (!ext) return { error: "Use a JPG, PNG or WebP photo" };
  if (file.size > AVATAR_MAX_BYTES) return { error: "The photo must be 2 MB or smaller" };

  const path = avatarPath(t.userId, ext);
  const admin = createAdminClient();
  const { error } = await admin.storage.from(AVATAR_BUCKET).upload(path, file, { contentType: file.type });
  if (error) return { error: error.message };
  const saved = await setPath(t, path);
  if (saved?.error) {
    await admin.storage.from(AVATAR_BUCKET).remove([path]);
    return saved;
  }
  revalidatePath(`/admin/${t.slug}`, "layout");
}

export async function removeAvatar(formData: FormData): Promise<ActionResult> {
  const t = await target(formData);
  if ("error" in t) return { error: t.error };
  const saved = await setPath(t, null);
  if (saved?.error) return saved;
  revalidatePath(`/admin/${t.slug}`, "layout");
}
