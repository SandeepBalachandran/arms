import { z } from "zod";
import type { Database } from "./database.types";

type Tables = Database["public"]["Tables"];
export type Plan = Tables["plans"]["Row"];
export type Subscription = Tables["subscriptions"]["Row"];
export type Payment = Tables["payments"]["Row"];
export type PaymentMethod = Database["public"]["Enums"]["payment_method"];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  online: "Online",
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  bank_transfer: "Bank transfer",
};

// Methods the front desk can record by hand (online goes through checkout).
export const MANUAL_PAYMENT_METHODS = ["cash", "upi", "card", "bank_transfer"] as const;

// Money ------------------------------------------------------------------------
// Amounts are integers in the smallest unit (paise).

export function formatMoney(paise: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

// "1,499.50" or "1499" (rupees, as typed) → 149950 paise.
export const rupeesSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/,/g, ""))
  .refine((v) => /^\d{1,7}(\.\d{1,2})?$/.test(v), "Enter an amount like 1499 or 1499.50")
  .transform((v) => Math.round(Number(v) * 100));

// Dates ------------------------------------------------------------------------
// Subscription dates are plain "YYYY-MM-DD" strings in the gym's timezone.

export function todayIn(timezone: string, now = new Date()) {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function toUtc(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

// Whole days from a to b ("2026-10-01" → "2026-10-03" is 2).
export function daysBetween(a: string, b: string) {
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

export function addDays(ymd: string, days: number) {
  return new Date(toUtc(ymd) + days * 86_400_000).toISOString().slice(0, 10);
}

export function formatDate(ymd: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    toUtc(ymd),
  );
}

// Membership state ---------------------------------------------------------------

type SubDates = Pick<Subscription, "status" | "starts_on" | "ends_on">;

export type MembershipState<S extends SubDates> =
  | { kind: "active"; current: S; daysLeft: number; next: S | null }
  | { kind: "upcoming"; next: S; startsIn: number }
  | { kind: "expired"; last: S; daysAgo: number }
  | { kind: "none" };

// Works out a member's membership from their subscriptions. Uses the dates, not
// only the status, so it is right even before the hourly expiry job runs.
export function membershipState<S extends SubDates>(subs: S[], today: string): MembershipState<S> {
  const live = subs
    .filter((s) => s.status === "active" && s.ends_on >= today)
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  const current = live.find((s) => s.starts_on <= today);
  const next = live.find((s) => s.starts_on > today) ?? null;

  if (current) {
    // Stacked renewals extend the days left.
    const lastEnd = live.reduce((end, s) => (s.ends_on > end ? s.ends_on : end), current.ends_on);
    return { kind: "active", current, daysLeft: daysBetween(today, lastEnd) + 1, next };
  }
  if (next) return { kind: "upcoming", next, startsIn: daysBetween(today, next.starts_on) };

  const last = subs
    .filter((s) => s.status !== "cancelled" && s.ends_on < today)
    .sort((a, b) => b.ends_on.localeCompare(a.ends_on))[0];
  if (last) return { kind: "expired", last, daysAgo: daysBetween(last.ends_on, today) };
  return { kind: "none" };
}

export function formatDuration(days: number) {
  if (days % 365 === 0) return days === 365 ? "1 year" : `${days / 365} years`;
  if (days % 30 === 0) return days === 30 ? "1 month" : `${days / 30} months`;
  if (days % 7 === 0) return days === 7 ? "1 week" : `${days / 7} weeks`;
  return days === 1 ? "1 day" : `${days} days`;
}
