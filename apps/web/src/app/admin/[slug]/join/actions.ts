"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// The database checks the permission too: this column is a gym section
// switch, so it needs manage_sections (see protect_gym_columns).
export async function setJoinApproval(formData: FormData): Promise<ActionResult> {
  const { slug, value } = z
    .object({ slug: z.string(), value: z.enum(["true", "false"]) })
    .parse(Object.fromEntries(formData));
  const { gym, can } = await requirePermission(slug, "manage_members");
  if (!can("manage_sections")) return { error: "Ask the owner for access to turn this on or off" };
  const supabase = await createClient();
  const { error } = await supabase.from("gyms").update({ join_requires_approval: value === "true" }).eq("id", gym.id);
  if (error) return { error: error.message };
  revalidatePath(`/admin/${slug}`, "layout");
}
