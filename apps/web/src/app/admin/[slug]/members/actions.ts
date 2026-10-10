"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { internationalPhone, MANUAL_PAYMENT_METHODS, rupeesSchema } from "@gymos/shared";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { requireGym, STAFF_ROLES, TEAM_ROLES } from "@/lib/auth";
import { findOrCreateUser } from "@/lib/member-accounts";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const roleSchema = z.object({
  slug: z.string(),
  id: z.uuid(),
  role: z.enum(["admin", "staff", "trainer", "member"]),
});

// RLS enforces the same rules (no owner edits, only owners grant admin);
// the checks here give a clear error instead of a silent no-op.
export async function updateMember(formData: FormData): Promise<ActionResult> {
  const { slug, id, role } = roleSchema.parse(Object.fromEntries(formData));
  const { gym, role: myRole } = await requireGym(slug, STAFF_ROLES);
  if (role === "admin" && myRole !== "owner") return { error: "Only the owner can make admins" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("gym_members")
    .update({ role })
    .eq("id", id)
    .eq("gym_id", gym.id)
    .neq("role", "owner");
  if (error) return { error: error.message };

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

export async function cancelSubscription(formData: FormData): Promise<ActionResult> {
  const { slug, member_id, id } = z
    .object({ slug: z.string(), member_id: z.uuid(), id: z.uuid() })
    .parse(Object.fromEntries(formData));
  await requireGym(slug, STAFF_ROLES);

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_subscription", { p_subscription_id: id });
  if (error) return { error: error.message };
  revalidatePath(`/admin/${slug}/members/${member_id}`);
}

// Approve or turn down someone who joined while "Approve new members" is on.
export async function reviewJoinRequest(formData: FormData): Promise<ActionResult> {
  const { slug, member_id, approve } = z
    .object({ slug: z.string(), member_id: z.uuid(), approve: z.enum(["true", "false"]) })
    .parse(Object.fromEntries(formData));
  await requireGym(slug, STAFF_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_join_request", {
    p_member_id: member_id,
    p_approve: approve === "true",
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/${slug}`, "layout");
}

export type AddMemberState = { error?: string } | undefined;

const addMemberSchema = z
  .object({
    slug: z.string(),
    full_name: z.string().trim().min(2, "Enter the member's name").max(80),
    email: z.union([z.literal(""), z.email("Enter a valid email")]),
    phone: z.string().trim().max(20),
  })
  .refine((v) => v.email || v.phone, "Enter a phone number or an email");

// Front desk adds a member directly (walk-ins, people without the app).
export async function addMember(_prev: AddMemberState, formData: FormData): Promise<AddMemberState> {
  const parsed = addMemberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { slug, full_name, email, phone } = parsed.data;
  const { gym } = await requireGym(slug, STAFF_ROLES);

  const intlPhone = phone ? internationalPhone(phone, gym.phone_country_code) : null;
  if (phone && !intlPhone) return { error: "Check the phone number" };

  const admin = createAdminClient();
  const account = await findOrCreateUser(admin, { full_name, email, phone, intlPhone });
  if (account.error !== undefined) return { error: account.error };
  const userId = account.userId;

  const { data: member, error } = await admin
    .from("gym_members")
    .insert({ gym_id: gym.id, user_id: userId, role: "member", status: "active" })
    .select("id")
    .single();
  if (error) {
    return { error: error.code === "23505" ? "This person is already in your gym." : error.message };
  }

  revalidatePath(`/admin/${slug}`, "layout");
  redirect(`/admin/${slug}/members/${member.id}?added=1`);
}

// Staff fix a member's name or phone. Uses the service role because profiles
// are only self-editable under RLS; the member must belong to this gym.
export type DetailsState = { error?: string; saved?: boolean } | undefined;

export async function updateMemberDetails(_prev: DetailsState, formData: FormData): Promise<DetailsState> {
  const parsed = z
    .object({
      slug: z.string(),
      member_id: z.uuid(),
      full_name: z.string().trim().min(2, "Enter a name").max(80),
      phone: z.string().trim().max(20).transform((v) => v || null),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { slug, member_id, full_name, phone } = parsed.data;
  const { gym } = await requireGym(slug, STAFF_ROLES);

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("gym_members")
    .select("user_id")
    .eq("id", member_id)
    .eq("gym_id", gym.id)
    .maybeSingle();
  if (!member) return { error: "Member not found" };

  const { error } = await admin.from("profiles").update({ full_name, phone }).eq("id", member.user_id);
  if (error) return { error: error.message };
  revalidatePath(`/admin/${slug}`, "layout");
  return { saved: true };
}

// Remove someone from the gym (they lose access; history is kept) or restore them.
export async function setMemberActive(formData: FormData): Promise<ActionResult> {
  const { slug, member_id, active } = z
    .object({ slug: z.string(), member_id: z.uuid(), active: z.enum(["true", "false"]) })
    .parse(Object.fromEntries(formData));
  const { gym, user } = await requireGym(slug, STAFF_ROLES);

  const supabase = await createClient();
  const { error } = await supabase
    .from("gym_members")
    .update({ status: active === "true" ? "active" : "inactive" })
    .eq("id", member_id)
    .eq("gym_id", gym.id)
    .neq("role", "owner")
    .neq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath(`/admin/${slug}`, "layout");
}

export async function addNote(formData: FormData): Promise<ActionResult> {
  const { slug, member_id, body } = z
    .object({ slug: z.string(), member_id: z.uuid(), body: z.string().trim().min(1).max(1000) })
    .parse(Object.fromEntries(formData));
  const { gym } = await requireGym(slug, TEAM_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.from("member_notes").insert({ gym_id: gym.id, member_id, body });
  if (error) return { error: error.message };
  revalidatePath(`/admin/${slug}/members/${member_id}`);
}

export async function deleteNote(formData: FormData): Promise<ActionResult> {
  const { slug, member_id, id } = z
    .object({ slug: z.string(), member_id: z.uuid(), id: z.uuid() })
    .parse(Object.fromEntries(formData));
  const { gym } = await requireGym(slug, TEAM_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.from("member_notes").delete().eq("id", id).eq("gym_id", gym.id);
  if (error) return { error: error.message };
  revalidatePath(`/admin/${slug}/members/${member_id}`);
}
