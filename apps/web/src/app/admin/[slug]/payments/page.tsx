import type { Metadata } from "next";
import Link from "next/link";
import { addDays, formatMoney, formatReceipt, PAYMENT_METHOD_LABELS, todayIn, type PaymentMethod } from "@gymos/shared";
import { Card, PageHeader } from "@/components/ui";
import { requireGym, STAFF_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PendingPayments } from "./pending-payments";

export const metadata: Metadata = { title: "Payments" };

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export default async function PaymentsPage({ params, searchParams }: PageProps<"/admin/[slug]/payments">) {
  const { slug } = await params;
  const { month: monthParam } = await searchParams;
  const { gym } = await requireGym(slug, STAFF_ROLES);

  const thisMonth = todayIn(gym.timezone).slice(0, 7);
  const month = typeof monthParam === "string" && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : thisMonth;

  // Fetch a day either side in UTC, then keep rows whose date in the gym's
  // timezone falls in the month.
  const from = addDays(`${month}-01`, -1);
  const to = addDays(`${shiftMonth(month, 1)}-01`, 1);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select("id, receipt_no, amount_paise, method, note, paid_at, member_id, gym_members!inner(profiles!inner(full_name))")
    .eq("gym_id", gym.id)
    .eq("status", "paid")
    .gte("paid_at", from)
    .lt("paid_at", to)
    .order("paid_at", { ascending: false });
  if (error) throw error;

  const payments = data.filter((p) => todayIn(gym.timezone, new Date(p.paid_at!)).startsWith(month));
  const total = payments.reduce((sum, p) => sum + p.amount_paise, 0);
  const byMethod = new Map<PaymentMethod, number>();
  for (const p of payments) byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amount_paise);

  const monthLabel = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-01T00:00:00Z`),
  );

  return (
    <>
      <PageHeader
        title="Payments"
        actions={
          <div className="flex items-center gap-2 text-sm">
            <Link href={`?month=${shiftMonth(month, -1)}`} className="rounded-lg border border-border px-3 py-1.5">←</Link>
            <span className="min-w-36 text-center font-medium">{monthLabel}</span>
            {month < thisMonth && (
              <Link href={`?month=${shiftMonth(month, 1)}`} className="rounded-lg border border-border px-3 py-1.5">→</Link>
            )}
          </div>
        }
      />

      <PendingPayments slug={slug} gymId={gym.id} currency={gym.currency} timezone={gym.timezone} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-sm text-muted">Collected</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{formatMoney(total, gym.currency)}</p>
          <p className="text-xs text-muted">{payments.length} payments</p>
        </Card>
        {[...byMethod].map(([method, amount]) => (
          <Card key={method}>
            <p className="text-sm text-muted">{PAYMENT_METHOD_LABELS[method]}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{formatMoney(amount, gym.currency)}</p>
          </Card>
        ))}
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-muted">
            <tr>
              <th className="p-3 font-medium">Receipt</th>
              <th className="p-3 font-medium">Date</th>
              <th className="p-3 font-medium">Member</th>
              <th className="p-3 font-medium">Amount</th>
              <th className="p-3 font-medium">Method</th>
              <th className="p-3 font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0">
                <td className="p-3 font-mono">{formatReceipt(gym.receipt_prefix, p.receipt_no)}</td>
                <td className="p-3 text-muted">
                  {new Date(p.paid_at!).toLocaleString("en-IN", { timeZone: gym.timezone, dateStyle: "medium", timeStyle: "short" })}
                </td>
                <td className="p-3">
                  <Link href={`/admin/${slug}/members/${p.member_id}`} className="hover:underline">
                    {p.gym_members.profiles.full_name || "Unnamed member"}
                  </Link>
                </td>
                <td className="p-3 tabular-nums">{formatMoney(p.amount_paise, gym.currency)}</td>
                <td className="p-3">{PAYMENT_METHOD_LABELS[p.method]}</td>
                <td className="p-3 text-muted">{p.note ?? ""}</td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted">No payments this month.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </>
  );
}
