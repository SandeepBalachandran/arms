"use server";

import { revalidatePath } from "next/cache";
import { MANUAL_PAYMENT_METHODS, rupeesSchema } from "@gymos/shared";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { requireGym, STAFF_ROLES, TEAM_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type PtState = { error?: string; saved?: boolean } | undefined;

// PT shows on the PT page and on member pages, so refresh the whole admin.
function refresh(slug: string) {
  revalidatePath(`/admin/${slug}`, "layout");
}

const packageSchema = z.object({
  slug: z.string(),
  id: z.string().optional(),
  name: z.string().trim().min(2, "Name is too short").max(60),
  description: z.string().trim().max(300).transform((v) => v || null),
  price: rupeesSchema,
  // Empty = unlimited sessions while valid.
  sessions: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 500), "Sessions must be 1–500"),
  validity_days: z.coerce.number().int().min(1, "Valid for at least 1 day").max(3660),
  sort_order: z.coerce.number().int().min(0).max(1000).catch(0),
});

export async function savePackage(_prev: PtState, formData: FormData): Promise<PtState> {
  const parsed = packageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { slug, id, price, ...values } = parsed.data;
  const { gym } = await requireGym(slug, ["owner", "admin"]);

  const supabase = await createClient();
  const row = { ...values, price_paise: price };
  const { error } = id
    ? await supabase.from("pt_packages").update(row).eq("id", id).eq("gym_id", gym.id)
    : await supabase.from("pt_packages").insert({ ...row, gym_id: gym.id });
  if (error) return { error: error.message };
  refresh(slug);
  return { saved: true };
}

export async function togglePackage(formData: FormData): Promise<ActionResult> {
  const { slug, id, is_active } = z
    .object({ slug: z.string(), id: z.uuid(), is_active: z.enum(["true", "false"]) })
    .parse(Object.fromEntries(formData));
  const { gym } = await requireGym(slug, ["owner", "admin"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("pt_packages")
    .update({ is_active: is_active === "true" })
    .eq("id", id)
    .eq("gym_id", gym.id);
  if (error) return { error: error.message };
  refresh(slug);
}

export async function deletePackage(formData: FormData): Promise<ActionResult> {
  const { slug, id } = z.object({ slug: z.string(), id: z.uuid() }).parse(Object.fromEntries(formData));
  const { gym } = await requireGym(slug, ["owner", "admin"]);
  const supabase = await createClient();
  // RLS only allows deleting packages that were never sold.
  const { data, error } = await supabase.from("pt_packages").delete().eq("id", id).eq("gym_id", gym.id).select("id");
  if (error) return { error: error.message };
  if (data.length === 0) return { error: "This package has been sold, so it can only be hidden." };
  refresh(slug);
}

const sellSchema = z.object({
  slug: z.string(),
  member_id: z.uuid("Choose a member"),
  package_id: z.uuid("Choose a package"),
  trainer_member_id: z.union([z.literal(""), z.uuid()]),
  method: z.enum(MANUAL_PAYMENT_METHODS),
  amount: rupeesSchema,
  starts_on: z.union([z.literal(""), z.iso.date()]),
  note: z.string().trim().max(300),
});

export async function sellPackage(_prev: PtState, formData: FormData): Promise<PtState> {
  const parsed = sellSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  await requireGym(d.slug, STAFF_ROLES);

  const supabase = await createClient();
  const { error } = await supabase.rpc("sell_pt_package", {
    p_member_id: d.member_id,
    p_package_id: d.package_id,
    p_method: d.method,
    p_amount_paise: d.amount,
    // Null leaves the trainer unassigned (the generated type marks it required).
    p_trainer_member_id: (d.trainer_member_id || null) as string,
    ...(d.starts_on ? { p_starts_on: d.starts_on } : {}),
    ...(d.note ? { p_note: d.note } : {}),
  });
  if (error) return { error: error.message };
  refresh(d.slug);
  return { saved: true };
}

const logSchema = z.object({
  slug: z.string(),
  pt_subscription_id: z.uuid(),
  session_on: z.union([z.literal(""), z.iso.date()]).optional(),
  notes: z.string().trim().max(300).optional(),
});

// Trainers log their own clients' sessions; the RPC checks who may log.
export async function logSession(_prev: PtState, formData: FormData): Promise<PtState> {
  const parsed = logSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  await requireGym(d.slug, TEAM_ROLES);

  const supabase = await createClient();
  const { error } = await supabase.rpc("log_pt_session", {
    p_pt_subscription_id: d.pt_subscription_id,
    ...(d.session_on ? { p_session_on: d.session_on } : {}),
    ...(d.notes ? { p_notes: d.notes } : {}),
  });
  if (error) return { error: error.message };
  refresh(d.slug);
  return { saved: true };
}

export async function deleteSession(formData: FormData): Promise<ActionResult> {
  const { slug, id } = z.object({ slug: z.string(), id: z.uuid() }).parse(Object.fromEntries(formData));
  await requireGym(slug, TEAM_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_pt_session", { p_session_id: id });
  if (error) return { error: error.message };
  refresh(slug);
}

export async function changeTrainer(formData: FormData): Promise<ActionResult> {
  const { slug, id, trainer_member_id } = z
    .object({ slug: z.string(), id: z.uuid(), trainer_member_id: z.union([z.literal(""), z.uuid()]) })
    .parse(Object.fromEntries(formData));
  const { gym } = await requireGym(slug, STAFF_ROLES);
  const supabase = await createClient();
  const { error } = await supabase
    .from("pt_subscriptions")
    .update({ trainer_member_id: trainer_member_id || null })
    .eq("id", id)
    .eq("gym_id", gym.id);
  if (error) return { error: error.message };
  refresh(slug);
}

export async function cancelPtSubscription(formData: FormData): Promise<ActionResult> {
  const { slug, id } = z.object({ slug: z.string(), id: z.uuid() }).parse(Object.fromEntries(formData));
  const { gym } = await requireGym(slug, STAFF_ROLES);
  const supabase = await createClient();
  const { error } = await supabase
    .from("pt_subscriptions")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("gym_id", gym.id);
  if (error) return { error: error.message };
  refresh(slug);
}
