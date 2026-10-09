import Link from "next/link";
import { formatMoney } from "@gymos/shared";
import { Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { reviewUpiPayment } from "./actions";

// UPI payments members say they made, waiting for staff to check their UPI app.
export async function PendingPayments({ slug, gymId, currency, timezone }: {
  slug: string;
  gymId: string;
  currency: string;
  timezone: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select("id, amount_paise, utr, created_at, member_id, plans(name), gym_members!inner(profiles!inner(full_name, phone))")
    .eq("gym_id", gymId)
    .eq("status", "created")
    .order("created_at");
  if (error) throw error;
  if (data.length === 0) return null;

  return (
    <Card className="mb-6 border-amber-500/50">
      <h2 className="font-medium">Waiting for confirmation ({data.length})</h2>
      <p className="mt-1 text-sm text-muted">
        Check that each amount reached your UPI account (match the reference number), then confirm.
      </p>
      <ul className="mt-3 divide-y divide-border">
        {data.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
            <div>
              <Link href={`/admin/${slug}/members/${p.member_id}`} className="font-medium hover:underline">
                {p.gym_members.profiles.full_name || "Unnamed member"}
              </Link>
              <p className="text-muted">
                {formatMoney(p.amount_paise, currency)} · {p.plans?.name ?? "Plan removed"} ·{" "}
                {new Date(p.created_at).toLocaleString("en-IN", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" })}
              </p>
              <p className="text-muted">
                UPI ref: <span className="font-mono text-foreground">{p.utr ?? "not given"}</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <form action={reviewUpiPayment}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="decision" value="confirm" />
                <button className="rounded-lg bg-brand px-3 py-1.5 font-medium text-brand-fg">Confirm</button>
              </form>
              <form action={reviewUpiPayment} className="flex gap-1">
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="decision" value="reject" />
                <input
                  name="reason"
                  placeholder="Reason (optional)"
                  maxLength={300}
                  className="w-40 rounded-lg border border-border bg-surface px-2 py-1.5"
                />
                <button className="rounded-lg border border-border px-3 py-1.5 text-danger">Reject</button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
