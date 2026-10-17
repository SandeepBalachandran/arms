import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown, Sparkles } from "lucide-react";
import { BRAND, PRICING, rupees } from "@gymos/shared";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCurrentUser } from "@/lib/auth";
import { getTheme } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Pricing",
  description: `One plan with everything, ${rupees(PRICING.monthly)} a month. First month free, nothing to pay to start.`,
};

// Public pricing for gym owners. Linked from the home page ("Own a gym?"),
// not from sign-in, so members don't come across it. Prices: packages/shared/src/pricing.ts.

const INCLUDED: { group: string; items: string[] }[] = [
  { group: "Members & money", items: ["Members join from one WhatsApp link", "Plans, renewals and receipts", "UPI straight to your account, ₹0 fees", "Cash and card entries", "One-tap WhatsApp renewal reminders", "Import members from Excel"] },
  { group: "Front desk", items: ["QR check-in, no biometric machine", "Live visits today", "Phone alert when a member pays by UPI"] },
  { group: "Training", items: ["Classes, bookings and waitlists", "Workout plans with how-to videos", "Food and water coaching", "PT packages and sessions", "Progress and weigh-ins"] },
  { group: "Your team", items: ["Owner, admin, front desk and trainers", "You decide who can do what", "Activity log nobody can delete", "Members' app in English and മലയാളം"] },
];

const FAQ: { q: string; a: string }[] = [
  { q: "Do my members pay anything?", a: `No. The member app is free for your members. Only the gym pays for ${BRAND.name}.` },
  { q: "Are there fees on UPI payments?", a: "No. Members pay to your own UPI ID, so the money reaches your bank account in full. We never touch it." },
  { q: "Is there a registration fee?", a: `Yes, ${rupees(PRICING.registrationFee)} once. It's added to your first payment, after the free month, so you never pay it before you've tried the app. Once paid, it isn't refunded.` },
  { q: "What if I pay you late?", a: "Nothing stops. We'll remind you, and your gym keeps running as usual. Your members won't notice a thing." },
  { q: "Do I need a computer?", a: "No. Everything works on a phone: you, your front desk and your trainers. Install it from the browser in a few seconds." },
  { q: "Who sets it up?", a: "You can do it yourself in a few minutes. Or we'll do it with you, free: import your members from Excel, print your QR poster and show your staff around." },
  { q: "Can I stop any time?", a: "Yes, there's no contract. Download your members and payments as a spreadsheet whenever you like; your data is yours." },
];

export default async function PricingPage() {
  const user = await getCurrentUser();
  const typicalFirstYear = 3000 + 400 * 12;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 sm:py-10">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-xl font-bold">
          {BRAND.logo[0]}<span className="text-brand">{BRAND.logo[1]}</span>
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <ThemeToggle initial={await getTheme()} />
          <Link href={user ? "/go" : "/login"} className="px-2 hover:underline">{user ? `Open ${BRAND.name}` : "Sign in"}</Link>
        </nav>
      </header>

      <section className="py-10 text-center sm:py-14">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand">Pricing for gym owners</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">One plan. Everything included.</h1>
        <p className="mx-auto mt-3 max-w-xl text-muted">
          First month free, nothing to pay to start. No per-member charges, no contract.
        </p>
      </section>

      {/* Founding gyms */}
      <section className="relative overflow-hidden rounded-2xl bg-[#1f2a10] p-6 text-white sm:p-8">
        <div aria-hidden className="absolute -right-16 -top-16 size-56 rounded-full bg-[#c8f04b]/10" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-[#c8f04b] px-3 py-1 text-xs font-bold text-[#141a04]">
              <Sparkles className="size-3.5" aria-hidden /> Founding gyms · first {PRICING.founding.spots} only
            </p>
            <p className="mt-3 text-3xl font-bold sm:text-4xl">
              {rupees(PRICING.founding.monthly)}<span className="text-lg font-medium text-white/70"> /month, locked for life</span>
            </p>
            <p className="mt-1 max-w-xl text-sm text-white/70">
              Join early, help us shape the app with your feedback, and your monthly price never goes up, for as long as you stay.
            </p>
          </div>
          <Link href="/register-gym" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#c8f04b] px-5 py-3 font-semibold text-[#141a04]">
            Claim a founding spot <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      {/* Regular price */}
      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <PriceCard title="Monthly" price={rupees(PRICING.monthly)} per="/month" note="Pay month by month. Stop any time." />
        <PriceCard
          title="Yearly"
          price={rupees(PRICING.yearly)}
          per="/year"
          note={`2 months free: about ${rupees(Math.round(PRICING.yearly / 12))} a month.`}
          badge="Best value"
        />
      </section>
      <p className="mt-3 text-center text-sm text-muted">
        Both include everything below, for unlimited members and staff. {PRICING.freeMonths === 1 ? "The first month is free" : `The first ${PRICING.freeMonths} months are free`}, with no payment needed to start.
      </p>
      <p className="mt-1 text-center text-sm text-muted">
        A one-time registration fee of {rupees(PRICING.registrationFee)} is added to your first payment, after the free month. It isn&apos;t refunded once paid.
      </p>

      {/* Everything included */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold tracking-tight">Everything included</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {INCLUDED.map(({ group, items }) => (
            <div key={group} className="rounded-xl border border-border bg-surface p-5">
              <h3 className="font-semibold">{group}</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* First year compared */}
      <section className="mt-12 rounded-xl border border-border bg-surface p-5 sm:p-6">
        <h2 className="text-xl font-bold tracking-tight">Your first year, compared</h2>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-lg bg-border/30 p-4">
            <p className="text-muted">Typical gym app</p>
            <p className="mt-1 text-2xl font-bold">{rupees(typicalFirstYear)}</p>
            <p className="mt-1 text-muted">{rupees(3000)} setup + about {rupees(400)} a month</p>
          </div>
          <div className="rounded-lg border border-brand/40 bg-brand/10 p-4">
            <p className="font-medium text-brand">{BRAND.name}, yearly</p>
            <p className="mt-1 text-2xl font-bold">{rupees(PRICING.yearly + PRICING.registrationFee)}</p>
            <p className="mt-1 text-muted">{rupees(PRICING.yearly)} a year + {rupees(PRICING.registrationFee)} registration, and the first month free</p>
          </div>
        </div>
      </section>

      {/* Questions */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold tracking-tight">Questions owners ask</h2>
        <div className="mt-5 divide-y divide-border rounded-xl border border-border bg-surface">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                {q}
                <ChevronDown className="size-4 shrink-0 text-muted transition group-open:rotate-180" aria-hidden />
              </summary>
              <p className="mt-2 text-sm text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="my-14 text-center">
        <h2 className="text-2xl font-bold tracking-tight">Try it free for a month</h2>
        <p className="mt-2 text-muted">Set up your gym in a few minutes. No payment needed to start.</p>
        <Link href="/register-gym" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 font-medium text-brand-fg">
          Register your gym <ArrowRight className="size-4" />
        </Link>
        <p className="mt-4 text-xs text-muted">Prices in Indian rupees, plus GST if applicable.</p>
      </section>
    </main>
  );
}

function PriceCard({ title, price, per, note, badge }: { title: string; price: string; per: string; note: string; badge?: string }) {
  return (
    <div className={`relative rounded-2xl border bg-surface p-6 ${badge ? "border-brand" : "border-border"}`}>
      {badge && (
        <span className="absolute right-5 top-5 rounded-full bg-brand px-2.5 py-0.5 text-xs font-semibold text-brand-fg">{badge}</span>
      )}
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-2 text-4xl font-bold tracking-tight">
        {price}<span className="text-base font-medium text-muted">{per}</span>
      </p>
      <p className="mt-2 text-sm text-muted">{note}</p>
    </div>
  );
}
