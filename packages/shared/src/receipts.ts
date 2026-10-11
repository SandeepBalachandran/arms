import { formatDate, formatMoney, PAYMENT_METHOD_LABELS, type PaymentMethod } from "./memberships";
import { formatReceipt } from "./settings";

// One payment receipt, shown the same way in the admin (printable page), the
// member app (receipt screen) and as a PDF or WhatsApp message. The staff
// note is internal and never printed.

export type ReceiptInput = {
  gym: {
    name: string;
    address: string | null;
    phone: string | null;
    phone_country_code: string;
    logo_url: string | null;
    receipt_prefix: string;
    currency: string;
    timezone: string;
  };
  memberName: string;
  payment: {
    receipt_no: number | null;
    paid_at: string | null;
    amount_paise: number;
    method: PaymentMethod;
    utr: string | null;
  };
  // What was paid for: a membership plan or a PT package.
  item: { kind: "plan" | "pt"; name: string; starts_on: string | null; ends_on: string | null; sessions?: number | null } | null;
};

export type ReceiptView = ReturnType<typeof receiptView>;

export function receiptView(r: ReceiptInput) {
  const paidOn = r.payment.paid_at
    ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: r.gym.timezone }).format(new Date(r.payment.paid_at))
    : "—";
  const item = r.item;
  const what = !item ? "Payment" : item.kind === "pt" ? `Personal training: ${item.name}` : `Membership: ${item.name}`;
  const period = item?.starts_on && item.ends_on ? `${formatDate(item.starts_on)} – ${formatDate(item.ends_on)}` : null;
  const sessions = item?.kind === "pt" ? (item.sessions == null ? "Unlimited sessions" : `${item.sessions} sessions`) : null;
  return {
    gymName: r.gym.name,
    gymAddress: r.gym.address,
    gymPhone: r.gym.phone ? `+${r.gym.phone_country_code} ${r.gym.phone}` : null,
    logoUrl: r.gym.logo_url,
    number: formatReceipt(r.gym.receipt_prefix, r.payment.receipt_no),
    paidOn,
    memberName: r.memberName,
    what,
    period,
    sessions,
    method: PAYMENT_METHOD_LABELS[r.payment.method],
    reference: r.payment.utr,
    amount: formatMoney(r.payment.amount_paise, r.gym.currency),
  };
}

// Plain text for WhatsApp or the share sheet.
export function receiptText(v: ReceiptView) {
  return [
    `*${v.gymName}* · Receipt ${v.number}`,
    `Received from ${v.memberName} on ${v.paidOn}`,
    v.what,
    v.period && `Valid ${v.period}`,
    v.sessions,
    `Amount: ${v.amount} (${v.method}${v.reference ? `, ref ${v.reference}` : ""})`,
    "Thank you!",
  ]
    .filter(Boolean)
    .join("\n");
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// A standalone A5-ish page for printing or saving as a PDF.
export function receiptHtml(v: ReceiptView) {
  const row = (label: string, value: string | null) =>
    value ? `<tr><td class="l">${escape(label)}</td><td>${escape(value)}</td></tr>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Receipt ${escape(v.number)} · ${escape(v.gymName)}</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #18181b; margin: 0; padding: 32px; }
  .card { max-width: 480px; margin: 0 auto; border: 1px solid #e4e4e7; border-radius: 16px; padding: 28px; }
  header { display: flex; align-items: center; gap: 12px; }
  header img { width: 48px; height: 48px; border-radius: 12px; object-fit: cover; }
  h1 { font-size: 20px; margin: 0; } .muted { color: #71717a; font-size: 13px; }
  .title { display: flex; justify-content: space-between; align-items: baseline; margin: 24px 0 8px; }
  .title h2 { font-size: 16px; margin: 0; letter-spacing: .08em; text-transform: uppercase; color: #52525b; }
  .paid { color: #3f6212; background: #ecfccb; border-radius: 999px; padding: 2px 10px; font-size: 12px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  td { padding: 8px 0; border-top: 1px solid #f4f4f5; vertical-align: top; } td.l { color: #71717a; width: 38%; }
  .total { display: flex; justify-content: space-between; align-items: baseline; margin-top: 16px; padding-top: 16px; border-top: 2px solid #18181b; }
  .total strong { font-size: 24px; } footer { margin-top: 24px; text-align: center; }
</style></head><body><div class="card">
<header>${v.logoUrl ? `<img src="${escape(v.logoUrl)}" alt="">` : ""}<div><h1>${escape(v.gymName)}</h1>
${v.gymAddress ? `<div class="muted">${escape(v.gymAddress)}</div>` : ""}${v.gymPhone ? `<div class="muted">${escape(v.gymPhone)}</div>` : ""}</div></header>
<div class="title"><h2>Receipt ${escape(v.number)}</h2><span class="paid">PAID</span></div>
<table>${row("Date", v.paidOn)}${row("Received from", v.memberName)}${row("For", v.what)}${row("Valid", v.period)}${row("Sessions", v.sessions)}${row("Paid by", v.method)}${row("Reference", v.reference)}</table>
<div class="total"><span>Amount paid</span><strong>${escape(v.amount)}</strong></div>
<footer class="muted">Thank you!</footer></div></body></html>`;
}
