"use server";

import { revalidatePath } from "next/cache";
import { asCheckinResult, type CheckinResult } from "@gymos/shared";
import { z } from "zod";
import { requireGym, STAFF_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type CheckinState = { result?: CheckinResult; error?: string } | undefined;

// A scanned member QR code (from the webcam scanner).
export async function checkInByToken(slug: string, token: string): Promise<CheckinState> {
  await requireGym(slug, STAFF_ROLES);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_in_by_token", { p_token: token });
  if (error) return { error: error.message };
  revalidatePath(`/admin/${slug}/checkin`);
  return { result: asCheckinResult(data) };
}

// "Check in" button next to a member (search results, member page).
export async function checkInMember(_prev: CheckinState, formData: FormData): Promise<CheckinState> {
  const { slug, member_id } = z
    .object({ slug: z.string(), member_id: z.uuid() })
    .parse(Object.fromEntries(formData));
  await requireGym(slug, STAFF_ROLES);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_check_in", { p_member_id: member_id });
  if (error) return { error: error.message };
  revalidatePath(`/admin/${slug}`, "layout");
  return { result: asCheckinResult(data) };
}
