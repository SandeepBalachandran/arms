"use server";

import { revalidatePath } from "next/cache";
import { todayIn } from "@gymos/shared";
import { z } from "zod";
import { requireGym, STAFF_ROLES } from "@/lib/auth";
import { findOrCreateUser } from "@/lib/member-accounts";
import { checkRows, IMPORT_BATCH, IMPORT_COLUMNS, type RawRow } from "@/lib/member-import";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ImportOutcome = { line: number; outcome: "added" | "exists" | "failed"; message?: string };

const rowSchema = z.object(Object.fromEntries(IMPORT_COLUMNS.map((c) => [c, z.string().max(200)])) as Record<(typeof IMPORT_COLUMNS)[number], z.ZodString>);
const batchSchema = z.object({
  slug: z.string(),
  rows: z.array(z.object({ line: z.number().int().positive(), row: rowSchema })).min(1).max(IMPORT_BATCH),
});

// Imports one batch of rows (the page sends the file in batches to show
// progress). Every row is checked again here. Writes use the service key
// after the staff check, like Add member: they create logins, and imported
// memberships carry their real (past) dates, which the payment RPCs don't allow.
export async function importMembers(input: z.input<typeof batchSchema>): Promise<{ results: ImportOutcome[]; error?: string }> {
  const parsed = batchSchema.safeParse(input);
  if (!parsed.success) return { results: [], error: "This file couldn't be read. Try again from the template." };
  const { slug, rows } = parsed.data;
  const { gym, user } = await requireGym(slug, STAFF_ROLES);

  const supabase = await createClient();
  const { data: plans, error: plansError } = await supabase
    .from("plans")
    .select("id, name, duration_days, price_paise")
    .eq("gym_id", gym.id)
    .eq("is_active", true);
  if (plansError) return { results: [], error: plansError.message };

  const checked = checkRows(rows.map((r) => r.row as RawRow), plans, gym.phone_country_code);
  const today = todayIn(gym.timezone);
  const method = gym.manual_payment_methods[0] ?? "cash";
  const admin = createAdminClient();
  const results: ImportOutcome[] = [];

  for (const [i, row] of checked.entries()) {
    const line = rows[i].line;
    if (row.problems.length) {
      results.push({ line, outcome: "failed", message: row.problems.join("; ") });
      continue;
    }

    const account = await findOrCreateUser(admin, {
      full_name: row.full_name,
      email: row.email,
      phone: row.phone,
      intlPhone: row.intl_phone,
    });
    if (account.error !== undefined) {
      results.push({ line, outcome: "failed", message: account.error });
      continue;
    }

    const { data: member, error: memberError } = await admin
      .from("gym_members")
      .insert({ gym_id: gym.id, user_id: account.userId, role: "member", status: "active" })
      .select("id")
      .single();
    if (memberError) {
      // Already in the gym: leave their record and membership as they are.
      results.push(
        memberError.code === "23505"
          ? { line, outcome: "exists", message: "Already in your gym" }
          : { line, outcome: "failed", message: memberError.message },
      );
      continue;
    }

    const plan = plans.find((p) => p.id === row.plan_id);
    if (plan && row.starts_on && row.ends_on) {
      const { data: sub, error: subError } = await admin
        .from("subscriptions")
        .insert({
          gym_id: gym.id,
          member_id: member.id,
          plan_id: plan.id,
          plan_name: plan.name,
          price_paise: plan.price_paise,
          starts_on: row.starts_on,
          ends_on: row.ends_on,
          status: row.ends_on < today ? "expired" : "active",
          created_by: user.id,
        })
        .select("id")
        .single();
      if (subError) {
        results.push({ line, outcome: "failed", message: `Added, but the membership wasn't: ${subError.message}` });
        continue;
      }
      if (row.amount_paise !== null) {
        const { error: payError } = await admin.from("payments").insert({
          gym_id: gym.id,
          member_id: member.id,
          subscription_id: sub.id,
          plan_id: plan.id,
          amount_paise: row.amount_paise,
          method,
          status: "paid",
          // Midday UTC: the same calendar date in India and most timezones.
          paid_at: `${row.starts_on}T12:00:00Z`,
          recorded_by: user.id,
          note: "Imported",
        });
        if (payError) {
          results.push({ line, outcome: "failed", message: `Added, but the payment wasn't: ${payError.message}` });
          continue;
        }
      }
    }
    results.push({ line, outcome: "added" });
  }

  revalidatePath(`/admin/${slug}`, "layout");
  return { results };
}
