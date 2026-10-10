"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { requireGym } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Old posters stop working (e.g. a photo of it is being passed around).
export async function rotatePoster(formData: FormData): Promise<ActionResult> {
  const slug = z.string().parse(formData.get("slug"));
  const { gym } = await requireGym(slug, ["owner", "admin"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("rotate_checkin_poster", { p_gym_id: gym.id });
  if (error) return { error: error.message };
  revalidatePath(`/admin/${slug}/checkin/poster`);
}
