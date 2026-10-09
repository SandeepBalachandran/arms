"use server";

import { revalidatePath } from "next/cache";
import { MANUAL_PAYMENT_METHODS, rupeesSchema } from "@gymos/shared";
import { z } from "zod";
import { requireGym, STAFF_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const roleSchema = z.object({
  slug: z.string(),
  id: z.uuid(),
  role: z.enum(["admin", "staff", "trainer", "member"]),
});

// RLS enforces the same rules (no owner edits, only owners grant admin);
// the checks here give a clear error instead of a silent no-op.
export async function updateMember(formData: FormData) {
  const { slug, id, role } = roleSchema.parse(Object.fromEntries(formData));
  const { gym, role: myRole } = await requireGym(slug, STAFF_ROLES);
  if (role === "admin" && myRole !== "owner") throw new Error("Only the owner can make admins");

  const supabase = await createClient();
  const { error } = await supabase
    .from("gym_members")
    .update({ role })
    .eq("id", id)
    .eq("gym_id", gym.id)
    .neq("role", "owner");
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/${slug}/members`);
}

export type RecordPaymentState = { error?: string; saved?: boolean } | undefined;

const paymentSchema = z.object({
  slug: z.string(),
  member_id: z.uuid(),
  plan_id: z.uuid(),
  method: z.enum(MANUAL_PAYMENT_METHODS),
  amount: rupeesSchema,
  starts_on: z.union([z.literal(""), z.iso.date()]),
  note: z.string().trim().max(300),
});

// Creates the subscription and the paid payment in one transaction (RPC).
export async function recordPayment(
  _prev: RecordPaymentState,
  formData: FormData,
): Promise<RecordPaymentState> {
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { slug, member_id, plan_id, method, amount, starts_on, note } = parsed.data;
  await requireGym(slug, STAFF_ROLES);

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_manual_payment", {
    p_member_id: member_id,
    p_plan_id: plan_id,
    p_method: method,
    p_amount_paise: amount,
    ...(starts_on ? { p_starts_on: starts_on } : {}),
    ...(note ? { p_note: note } : {}),
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/${slug}`, "layout");
  return { saved: true };
}

export async function cancelSubscription(formData: FormData) {
  const { slug, member_id, id } = z
    .object({ slug: z.string(), member_id: z.uuid(), id: z.uuid() })
    .parse(Object.fromEntries(formData));
  await requireGym(slug, STAFF_ROLES);

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_subscription", { p_subscription_id: id });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/${slug}/members/${member_id}`);
}
