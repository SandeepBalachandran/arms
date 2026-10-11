import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { internationalPhone, receiptText, receiptView } from "@gymos/shared";
import { Badge } from "@/components/ui";
import { requireGym, STAFF_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ReceiptActions } from "./receipt-actions";

export const metadata: Metadata = { title: "Receipt" };

// A printable receipt for one paid payment (front desk, owner, admin).
export default async function ReceiptPage({ params }: PageProps<"/admin/[slug]/payments/[id]">) {
  const { slug, id } = await params;
  const { gym } = await requireGym(slug, STAFF_ROLES);
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("payments")
    .select(
      "receipt_no, paid_at, amount_paise, method, utr, status, member_id, gym_members!inner(profiles!inner(full_name, phone)), subscriptions(plan_name, starts_on, ends_on), pt_subscriptions(package_name, starts_on, ends_on, sessions_total)",
    )
    .eq("id", id)
    .eq("gym_id", gym.id)
    .maybeSingle();
  if (!p || p.status !== "paid") notFound();

  const profile = p.gym_members.profiles;
  const v = receiptView({
    gym,
    memberName: profile.full_name,
    payment: p,
    item: p.pt_subscriptions
      ? { kind: "pt", name: p.pt_subscriptions.package_name, starts_on: p.pt_subscriptions.starts_on, ends_on: p.pt_subscriptions.ends_on, sessions: p.pt_subscriptions.sessions_total }
      : p.subscriptions
        ? { kind: "plan", name: p.subscriptions.plan_name, starts_on: p.subscriptions.starts_on, ends_on: p.subscriptions.ends_on }
        : null,
  });
  const phone = profile.phone ? internationalPhone(profile.phone, gym.phone_country_code) : null;
  const whatsapp = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(receiptText(v))}` : null;

  const rows: [string, string | null][] = [
    ["Date", v.paidOn],
    ["Received from", v.memberName],
    ["For", v.what],
    ["Valid", v.period],
    ["Sessions", v.sessions],
    ["Paid by", v.method],
    ["Reference", v.reference],
  ];

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/admin/${slug}/members/${p.member_id}`} className="text-sm text-muted hover:text-foreground">
          ← {v.memberName}
        </Link>
        <ReceiptActions whatsappUrl={whatsapp} />
      </div>

      <article className="rounded-2xl border border-border bg-surface p-6 sm:p-8 print:border-0 print:p-0" aria-label={`Receipt ${v.number}`}>
        <header className="flex items-center gap-3">
          {v.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- small logo from storage, also printed
            <img src={v.logoUrl} alt="" className="size-12 rounded-xl object-cover" />
          )}
          <div>
            <h1 className="text-xl font-semibold">{v.gymName}</h1>
            {v.gymAddress && <p className="text-sm text-muted">{v.gymAddress}</p>}
            {v.gymPhone && <p className="text-sm text-muted">{v.gymPhone}</p>}
          </div>
        </header>

        <div className="mt-6 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Receipt {v.number}</h2>
          <Badge tone="good">Paid</Badge>
        </div>

        <dl className="mt-3 divide-y divide-border text-sm">
          {rows.filter(([, value]) => value).map(([label, value]) => (
            <div key={label} className="grid grid-cols-[9rem_1fr] gap-3 py-2.5">
              <dt className="text-muted">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 flex items-baseline justify-between border-t-2 border-foreground pt-4">
          <span className="font-medium">Amount paid</span>
          <strong className="text-2xl tabular-nums">{v.amount}</strong>
        </div>
        <p className="mt-6 text-center text-sm text-muted">Thank you!</p>
      </article>
    </div>
  );
}
