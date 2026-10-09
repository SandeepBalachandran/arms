import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  formatDate,
  formatMoney,
  formatReceipt,
  membershipState,
  num,
  PAYMENT_METHOD_LABELS,
  todayIn,
} from "@gymos/shared";
import { MembershipBadge } from "@/components/membership-badge";
import { Badge, Card, PageHeader } from "@/components/ui";
import { requireGym, STAFF_ROLES, TEAM_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hoursAgo } from "@/lib/time";
import { CheckInButton } from "../../checkin/check-in-button";
import { cancelSubscription } from "../actions";
import { RecordPaymentForm } from "./record-payment-form";

export const metadata: Metadata = { title: "Member" };

export default async function MemberPage({ params }: PageProps<"/admin/[slug]/members/[id]">) {
  const { slug, id } = await params;
  const { gym, role } = await requireGym(slug, TEAM_ROLES);
  const isStaff = STAFF_ROLES.includes(role);
  const supabase = await createClient();

  const { data: member } = await supabase
    .from("gym_members")
    .select("id, role, status, joined_at, profiles!inner(full_name, phone)")
    .eq("id", id)
    .eq("gym_id", gym.id)
    .maybeSingle();
  if (!member) notFound();

  const [subs, payments, plans, visits] = await Promise.all([
    supabase.from("subscriptions").select("*").eq("member_id", id).order("starts_on", { ascending: false }),
    isStaff
      ? supabase.from("payments").select("*").eq("member_id", id).order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    isStaff
      ? supabase.from("plans").select("*").eq("gym_id", gym.id).eq("is_active", true).order("sort_order").order("price_paise")
      : Promise.resolve({ data: [], error: null }),
    gym.checkin_enabled
      ? supabase.from("checkins").select("id, checked_in_at, method").eq("member_id", id)
          .gte("checked_in_at", hoursAgo(62 * 24))
          .order("checked_in_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (subs.error) throw subs.error;
  if (visits.error) throw visits.error;

  const progress = gym.workouts_enabled
    ? await Promise.all([
        supabase.from("plan_assignments").select("id, workout_plans!inner(id, name)").eq("member_id", id),
        supabase.from("workout_logs").select("id", { count: "exact", head: true })
          .eq("member_id", id).gte("performed_at", hoursAgo(30 * 24)),
        supabase.from("body_metrics").select("measured_on, weight_kg").eq("member_id", id)
          .not("weight_kg", "is", null).order("measured_on", { ascending: false }).limit(1).maybeSingle(),
      ])
    : null;
  if (payments.error) throw payments.error;
  if (plans.error) throw plans.error;

  const today = todayIn(gym.timezone);
  const state = membershipState(subs.data, today);
  const visitsThisMonth = visits.data.filter((v) =>
    todayIn(gym.timezone, new Date(v.checked_in_at)).startsWith(today.slice(0, 7)),
  ).length;

  return (
    <>
      <Link href={`/admin/${slug}/members`} className="text-sm text-muted hover:underline">← Members</Link>
      <PageHeader title={member.profiles.full_name || "Unnamed member"} />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div><span className="text-muted">Membership </span><MembershipBadge state={state} warnDays={gym.expiry_warning_days} /></div>
            <div><span className="text-muted">Phone </span>{member.profiles.phone ?? "—"}</div>
            <div><span className="text-muted">Role </span><span className="capitalize">{member.role}</span></div>
            <div><span className="text-muted">Joined </span>{new Date(member.joined_at).toLocaleDateString("en-IN", { timeZone: gym.timezone })}</div>
          </Card>

          {progress && (
            <Card className="text-sm">
              <h2 className="font-medium">Workouts & progress</h2>
              <p className="mt-1 text-muted">
                {progress[1].count ?? 0} workouts logged in the last 30 days
                {progress[2].data &&
                  ` · weight ${num(progress[2].data.weight_kg)} kg on ${formatDate(progress[2].data.measured_on)}`}
              </p>
              <p className="mt-1">
                <span className="text-muted">Plans: </span>
                {progress[0].data?.length
                  ? progress[0].data.map((a, i) => (
                      <span key={a.id}>
                        {i > 0 && ", "}
                        <Link href={`/admin/${slug}/workouts/${a.workout_plans.id}`} className="hover:underline">
                          {a.workout_plans.name}
                        </Link>
                      </span>
                    ))
                  : "none assigned (assign one from a plan's page)"}
              </p>
            </Card>
          )}

          {gym.checkin_enabled && (
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-medium">Visits</h2>
                  <p className="text-sm text-muted">
                    {visitsThisMonth} this month
                    {visits.data[0] &&
                      ` · last ${new Date(visits.data[0].checked_in_at).toLocaleString("en-IN", { timeZone: gym.timezone, dateStyle: "medium", timeStyle: "short" })}`}
                  </p>
                </div>
                {isStaff && <CheckInButton slug={slug} memberId={id} showResult />}
              </div>
            </Card>
          )}

          <section>
            <h2 className="mb-2 font-medium">Subscriptions</h2>
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-muted">
                  <tr>
                    <th className="p-3 font-medium">Plan</th>
                    <th className="p-3 font-medium">Period</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {subs.data.map((s) => {
                    const expired = s.status === "expired" || (s.status === "active" && s.ends_on < today);
                    return (
                      <tr key={s.id} className="border-b border-border last:border-0">
                        <td className="p-3">{s.plan_name} <span className="text-muted">· {formatMoney(s.price_paise, gym.currency)}</span></td>
                        <td className="p-3 text-muted">{formatDate(s.starts_on)} – {formatDate(s.ends_on)}</td>
                        <td className="p-3">
                          {s.status === "cancelled" ? <Badge tone="bad">Cancelled</Badge>
                            : expired ? <Badge>Expired</Badge>
                            : s.starts_on > today ? <Badge>Upcoming</Badge>
                            : <Badge tone="good">Active</Badge>}
                        </td>
                        <td className="p-3 text-right">
                          {isStaff && s.status === "active" && !expired && (
                            <form action={cancelSubscription}>
                              <input type="hidden" name="slug" value={slug} />
                              <input type="hidden" name="member_id" value={id} />
                              <input type="hidden" name="id" value={s.id} />
                              <button className="text-xs text-danger hover:underline">Cancel</button>
                            </form>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {subs.data.length === 0 && (
                    <tr><td colSpan={4} className="p-6 text-center text-muted">No subscriptions yet.</td></tr>
                  )}
                </tbody>
              </table>
            </Card>
          </section>

          {isStaff && (
            <section>
              <h2 className="mb-2 font-medium">Payments</h2>
              <Card className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead className="border-b border-border text-left text-muted">
                    <tr>
                      <th className="p-3 font-medium">Receipt</th>
                      <th className="p-3 font-medium">Date</th>
                      <th className="p-3 font-medium">Amount</th>
                      <th className="p-3 font-medium">Method</th>
                      <th className="p-3 font-medium">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.data.map((p) => (
                      <tr key={p.id} className="border-b border-border last:border-0">
                        <td className="p-3 font-mono">{p.receipt_no ? formatReceipt(gym.receipt_prefix, p.receipt_no) : <Badge>{p.status}</Badge>}</td>
                        <td className="p-3 text-muted">{new Date(p.paid_at ?? p.created_at).toLocaleDateString("en-IN", { timeZone: gym.timezone })}</td>
                        <td className="p-3 tabular-nums">{formatMoney(p.amount_paise, gym.currency)}</td>
                        <td className="p-3">{PAYMENT_METHOD_LABELS[p.method]}</td>
                        <td className="p-3 text-muted">{p.note ?? ""}</td>
                      </tr>
                    ))}
                    {payments.data.length === 0 && (
                      <tr><td colSpan={5} className="p-6 text-center text-muted">No payments yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </Card>
            </section>
          )}
        </div>

        {isStaff && (
          <Card className="h-fit">
            <h2 className="mb-1 font-medium">Record payment</h2>
            <p className="mb-4 text-sm text-muted">
              For cash, UPI or card at the front desk. Starts a new subscription
              {state.kind === "active" ? ` after the current one ends.` : " today."}
            </p>
            {plans.data.length === 0 ? (
              <p className="text-sm text-muted">
                Create a plan first on the <Link href={`/admin/${slug}/plans`} className="text-brand hover:underline">Plans</Link> page.
              </p>
            ) : (
              <RecordPaymentForm
                slug={slug}
                memberId={id}
                plans={plans.data}
                currency={gym.currency}
                methods={gym.manual_payment_methods.filter((m) => m !== "online")}
              />
            )}
          </Card>
        )}
      </div>
    </>
  );
}
