"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireGym, STAFF_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const reviewSchema = z.object({
  slug: z.string(),
  id: z.uuid(),
  decision: z.enum(["confirm", "reject"]),
  reason: z.string().trim().max(300).optional(),
});

// Staff checked their UPI app: confirm starts the subscription, reject tells
// the member why.
export async function reviewUpiPayment(formData: FormData) {
  const { slug, id, decision, reason } = reviewSchema.parse(Object.fromEntries(formData));
  await requireGym(slug, STAFF_ROLES);

  const supabase = await createClient();
  const { error } =
    decision === "confirm"
      ? await supabase.rpc("confirm_upi_payment", { p_payment_id: id })
      : await supabase.rpc("reject_upi_payment", { p_payment_id: id, ...(reason ? { p_reason: reason } : {}) });
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/${slug}`, "layout");
}
