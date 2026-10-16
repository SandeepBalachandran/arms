import Link from "next/link";
import { ArrowRight, CalendarDays, CreditCard, Dumbbell, QrCode } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCurrentUser } from "@/lib/auth";
import { getTheme } from "@/lib/theme";
import { BRAND } from "@gymos/shared";

const FEATURES = [
  { icon: CreditCard, title: "Memberships & payments", text: "Plans, UPI renewals straight to your account with no fees, cash entries and receipts." },
  { icon: QrCode, title: "QR check-in", text: "Members show a rotating QR code; the front desk scans it." },
  { icon: CalendarDays, title: "Classes & bookings", text: "Schedules, capacity, waitlists and attendance." },
  { icon: Dumbbell, title: "Workouts & progress", text: "Trainer-built plans, workout logs and body metrics." },
];

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 sm:py-10">
      <header className="flex items-center justify-between">
        <span className="text-xl font-bold">
          {BRAND.logo[0]}<span className="text-brand">{BRAND.logo[1]}</span>
        </span>
        <nav className="flex items-center gap-2 text-sm">
          <ThemeToggle initial={await getTheme()} />
          {user ? (
            <Link href="/go" className="px-2 hover:underline">Open {BRAND.name}</Link>
          ) : (
            <Link href="/login" className="px-2 hover:underline">Sign in</Link>
          )}
        </nav>
      </header>

      <section className="py-10 text-center sm:py-16">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Your gym in one app.</h1>
        <p className="mx-auto mt-3 max-w-xl text-muted">
          Members check in, book classes and renew. Owners and staff run the gym from the same app.
        </p>
        {/* Most visitors are members, so signing in comes first; registering a gym is for owners. */}
        <div className="mx-auto mt-7 flex max-w-xs flex-col items-center gap-3">
          <Link href={user ? "/go" : "/login"} className="w-full rounded-xl bg-brand px-5 py-3 font-medium text-brand-fg">
            {user ? `Open ${BRAND.name}` : "Sign in"}
          </Link>
          <p className="text-sm text-muted">
            Own a gym?{" "}
            <Link href="/register-gym" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
              Register your gym <ArrowRight className="size-3.5" />
            </Link>
            <span aria-hidden> · </span>
            <Link href="/pricing" className="font-medium text-brand hover:underline">
              Pricing
            </Link>
          </p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-xl border border-border bg-surface p-5">
            <Icon className="size-6 text-brand" />
            <h2 className="mt-3 font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted">{text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
