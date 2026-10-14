"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { requirePlatformAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Suspend a gym (its team and members lose access; data kept), make it active
// again, or restore one its owner deleted. The database logs it in the gym's Activity.
export async function setGymStatus(formData: FormData): Promise<ActionResult> {
  await requirePlatformAdmin();
  const { gym_id, status } = z
    .object({ gym_id: z.uuid(), status: z.enum(["active", "suspended"]) })
    .parse(Object.fromEntries(formData));
  const supabase = await createClient();
  const { error } = await supabase.rpc("platform_set_gym_status", { p_gym_id: gym_id, p_status: status });
  if (error) return { error: error.message };
  revalidatePath("/platform", "layout");
}
