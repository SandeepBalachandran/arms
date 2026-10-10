"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { requireGym, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type DeleteGymState = { error?: string } | undefined;

// Closes the gym now; the database keeps it for 30 days (restore_gym), then a
// daily job removes it. The RPC re-checks that the caller is an owner.
export async function deleteGym(_prev: DeleteGymState, formData: FormData): Promise<DeleteGymState> {
  const { slug, confirm } = z.object({ slug: z.string(), confirm: z.string() }).parse(Object.fromEntries(formData));
  const { gym } = await requireGym(slug, ["owner"]);
  if (confirm.trim().toLowerCase() !== gym.slug) return { error: `Type ${gym.slug} to confirm` };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_gym", { p_gym_id: gym.id, p_confirm: confirm });
  if (error) return { error: error.message };

  revalidatePath("/admin", "layout");
  redirect(`/admin?deleted=${encodeURIComponent(gym.name)}`);
}

export async function restoreGym(formData: FormData): Promise<ActionResult> {
  await requireUser("/admin");
  const { gym_id, slug } = z.object({ gym_id: z.uuid(), slug: z.string() }).parse(Object.fromEntries(formData));
  const supabase = await createClient();
  const { error } = await supabase.rpc("restore_gym", { p_gym_id: gym_id });
  if (error) return { error: error.message };

  revalidatePath("/admin", "layout");
  redirect(`/admin/${slug}`);
}
