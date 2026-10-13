"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const reviewSchema = z.object({
  slug: z.string(),
  id: z.uuid(),
  decision: z.enum(["confirm", "reject"]),
  reason: z.string().trim().max(300).optional(),
});

// Staff checked their UPI app: confirm starts the subscription, reject tells
// the member why.
export async function reviewUpiPayment(formData: FormData): Promise<ActionResult> {
  const { slug, id, decision, reason } = reviewSchema.parse(Object.fromEntries(formData));
  await requirePermission(slug, "confirm_upi");

  const supabase = await createClient();
  const { error } =
    decision === "confirm"
      ? await supabase.rpc("confirm_upi_payment", { p_payment_id: id })
      : await supabase.rpc("reject_upi_payment", { p_payment_id: id, ...(reason ? { p_reason: reason } : {}) });
  if (error) return { error: error.message };

  revalidatePath(`/admin/${slug}`, "layout");
}
