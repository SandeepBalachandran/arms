"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { requireGym, STAFF_ROLES, TEAM_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; message?: string } | undefined;

const optionalInt = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : Number(v)))
  .refine((v) => v === undefined || (Number.isInteger(v) && v > 0), "Enter a whole number");

const typeSchema = z.object({
  slug: z.string(),
  name: z.string().trim().min(2, "Name is too short").max(60),
  description: z.string().trim().max(300).transform((v) => v || null),
  default_capacity: z.coerce.number().int().min(1).max(500),
  default_duration_min: z.coerce.number().int().min(5).max(480),
});

export async function createClassType(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = typeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { slug, ...values } = parsed.data;
  const { gym } = await requireGym(slug, STAFF_ROLES);

  const supabase = await createClient();
  const { error } = await supabase.from("class_types").insert({ ...values, gym_id: gym.id });
  if (error) return { error: error.message };
  revalidatePath(`/admin/${slug}/classes`);
  return { message: `Added ${values.name}.` };
}

export async function updateClassType(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = typeSchema.extend({ id: z.uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { slug, id, ...values } = parsed.data;
  const { gym } = await requireGym(slug, STAFF_ROLES);

  const supabase = await createClient();
  const { error } = await supabase.from("class_types").update(values).eq("id", id).eq("gym_id", gym.id);
  if (error) return { error: error.message };
  revalidatePath(`/admin/${slug}/classes`);
  return { message: `Saved ${values.name}.` };
}

// Archived types can't be scheduled again; classes already on the calendar stay.
export async function archiveClassType(formData: FormData): Promise<ActionResult> {
  const { slug, id } = z.object({ slug: z.string(), id: z.uuid() }).parse(Object.fromEntries(formData));
  const { gym } = await requireGym(slug, STAFF_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.from("class_types").update({ is_active: false }).eq("id", id).eq("gym_id", gym.id);
  if (error) return { error: error.message };
  revalidatePath(`/admin/${slug}/classes`);
}

const seriesSchema = z.object({
  slug: z.string(),
  class_type_id: z.uuid("Choose a class"),
  weekdays: z.array(z.coerce.number().int().min(0).max(6)).min(1, "Pick at least one day"),
  local_time: z.string().regex(/^\d{2}:\d{2}$/, "Pick a time"),
  start_date: z.iso.date("Pick a start date"),
  weeks: z.coerce.number().int().min(1).max(26),
  trainer_member_id: z.union([z.literal(""), z.uuid()]),
  capacity: optionalInt,
  duration_min: optionalInt,
  room: z.string().trim().max(60),
});

export async function createSeries(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = seriesSchema.safeParse({
    ...Object.fromEntries(formData),
    weekdays: formData.getAll("weekdays"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  await requireGym(d.slug, STAFF_ROLES);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_class_series", {
    p_class_type_id: d.class_type_id,
    p_weekdays: d.weekdays,
    p_local_time: d.local_time,
    p_start_date: d.start_date,
    p_weeks: d.weeks,
    ...(d.trainer_member_id ? { p_trainer_member_id: d.trainer_member_id } : {}),
    ...(d.capacity ? { p_capacity: d.capacity } : {}),
    ...(d.duration_min ? { p_duration_min: d.duration_min } : {}),
    ...(d.room ? { p_room: d.room } : {}),
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/${d.slug}/classes`);
  return { message: data === 1 ? "Added 1 class." : `Added ${data} classes.` };
}

export async function cancelSession(formData: FormData): Promise<ActionResult> {
  const { slug, id, reason } = z
    .object({ slug: z.string(), id: z.uuid(), reason: z.string().trim().max(300) })
    .parse(Object.fromEntries(formData));
  await requireGym(slug, STAFF_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_class_session", {
    p_session_id: id,
    ...(reason ? { p_reason: reason } : {}),
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/${slug}/classes`, "layout");
}

export async function markAttendance(formData: FormData): Promise<ActionResult> {
  const { slug, session_id, booking_id, attended } = z
    .object({ slug: z.string(), session_id: z.uuid(), booking_id: z.uuid(), attended: z.enum(["true", "false"]) })
    .parse(Object.fromEntries(formData));
  // Trainers can mark their own sessions; the RPC checks which session.
  await requireGym(slug, TEAM_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_attendance", {
    p_booking_id: booking_id,
    p_attended: attended === "true",
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/${slug}/classes/${session_id}`);
}

export async function removeBooking(formData: FormData): Promise<ActionResult> {
  const { slug, session_id, booking_id } = z
    .object({ slug: z.string(), session_id: z.uuid(), booking_id: z.uuid() })
    .parse(Object.fromEntries(formData));
  await requireGym(slug, STAFF_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_booking", { p_booking_id: booking_id });
  if (error) return { error: error.message };
  revalidatePath(`/admin/${slug}/classes/${session_id}`);
}
