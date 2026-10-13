"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { GRID_ROLES, PERMISSIONS } from "@gymos/shared";
import type { ActionResult } from "@/lib/action-result";
import { requireGym } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type GridState = { error?: string; saved?: boolean } | undefined;

// The owner's grid. Only cells that differ from the defaults are stored, so
// "Reset to defaults" is just clearing them. RLS lets only the owner write.
export async function saveGrid(_prev: GridState, formData: FormData): Promise<GridState> {
  const slug = z.string().parse(formData.get("slug"));
  const { gym } = await requireGym(slug, ["owner"]);
  const supabase = await createClient();

  const { data: grid, error } = await supabase.rpc("permission_grid", { p_gym_id: gym.id });
  if (error) return { error: error.message };
  // Stored cells always differ from the default, so a stored cell's default is its opposite.
  const defaults = new Map(grid.map((c) => [`${c.role}:${c.permission}`, c.is_default ? c.allowed : !c.allowed]));

  const ticked = new Set(formData.getAll("cell").map(String));
  const keep: { gym_id: string; role: (typeof GRID_ROLES)[number]; permission: string; allowed: boolean; updated_at: string }[] = [];
  const clear: string[] = [];
  for (const role of GRID_ROLES) {
    for (const { key } of PERMISSIONS) {
      const id = `${role}:${key}`;
      if (!defaults.has(id)) continue;
      const allowed = ticked.has(id);
      if (allowed === defaults.get(id)) clear.push(id);
      else keep.push({ gym_id: gym.id, role, permission: key, allowed, updated_at: new Date().toISOString() });
    }
  }

  if (keep.length) {
    const { error: upsertError } = await supabase.from("gym_role_permissions").upsert(keep);
    if (upsertError) return { error: upsertError.message };
  }
  for (const id of clear) {
    const [role, permission] = id.split(":");
    const { error: deleteError } = await supabase
      .from("gym_role_permissions")
      .delete()
      .eq("gym_id", gym.id)
      .eq("role", role as (typeof GRID_ROLES)[number])
      .eq("permission", permission);
    if (deleteError) return { error: deleteError.message };
  }
  revalidatePath(`/admin/${slug}`, "layout");
  return { saved: true };
}

export async function resetGrid(formData: FormData): Promise<ActionResult> {
  const slug = z.string().parse(formData.get("slug"));
  const { gym } = await requireGym(slug, ["owner"]);
  const supabase = await createClient();
  const { error } = await supabase.from("gym_role_permissions").delete().eq("gym_id", gym.id);
  if (error) return { error: error.message };
  revalidatePath(`/admin/${slug}`, "layout");
}
