import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { formatMoney } from "@gymos/shared";
import { alertTeam } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({ paymentId: z.uuid() });

// The member app calls this right after a member says they paid by UPI
// (claim_upi_payment). Whoever confirms UPI payments in that gym gets a phone
// alert. Signed in by cookie (web app on this site) or by a bearer token (the
// Android app). Only the member who made the claim can trigger its alert, and
// each claim alerts once.
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const admin = createAdminClient();
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  const { data: auth } = token ? await admin.auth.getUser(token) : await (await createClient()).auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const { data: payment } = await admin
    .from("payments")
    .select("id, gym_id, amount_paise, utr, status, method, plans(name), gym_members!inner(user_id, profiles(full_name)), gyms(slug, currency)")
    .eq("id", parsed.data.paymentId)
    .maybeSingle();
  if (!payment || payment.gym_members.user_id !== auth.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (payment.status !== "created" || payment.method !== "upi") return NextResponse.json({ sent: 0 });

  const who = payment.gym_members.profiles?.full_name || "A member";
  const money = formatMoney(payment.amount_paise, payment.gyms?.currency ?? "INR");
  const sent = await alertTeam(payment.gym_id, "confirm_upi", `upi-claim:${payment.id}`, {
    title: `${who} paid ${money} by UPI`,
    body: [payment.plans?.name, payment.utr ? `UTR ${payment.utr}` : "No UTR given", "Check your UPI app, then confirm"].filter(Boolean).join(" · "),
    url: `/admin/${payment.gyms?.slug}/payments`,
    tag: `upi-claim-${payment.id}`,
  });
  return NextResponse.json({ sent });
}
