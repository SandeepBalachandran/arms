import Link from "next/link";
import { CalendarDays, CreditCard, Dumbbell, QrCode } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { playStoreUrl } from "@/lib/site";

const FEATURES = [
  { icon: CreditCard, title: "Memberships & payments", text: "Plans, online renewals with Razorpay, cash entries and invoices." },
  { icon: QrCode, title: "QR check-in", text: "Members show a rotating QR code; the front desk scans it." },
  { icon: CalendarDays, title: "Classes & bookings", text: "Schedules, capacity, waitlists and attendance." },
  { icon: Dumbbell, title: "Workouts & progress", text: "Trainer-built plans, workout logs and body metrics." },
];

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <header className="flex items-center justify-between">
        <span className="text-xl font-bold">
          Gym<span className="text-brand">OS</span>
        </span>
        <nav className="flex gap-4 text-sm">
          {user ? (
            <Link href="/admin" className="hover:underline">Admin</Link>
          ) : (
            <Link href="/login" className="hover:underline">Sign in</Link>
          )}
        </nav>
      </header>

      <section className="py-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Run your gym from one place.</h1>
        <p className="mx-auto mt-4 max-w-xl text-muted">
          An admin panel for owners and staff, and an app your members install on their phone.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/register-gym" className="rounded-lg bg-brand px-5 py-2.5 font-medium text-brand-fg">
            Register your gym
          </Link>
          <a href={playStoreUrl()} className="rounded-lg border border-border px-5 py-2.5 font-medium">
            Get the member app
          </a>
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
