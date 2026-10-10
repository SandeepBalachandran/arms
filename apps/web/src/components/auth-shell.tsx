import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import clsx from "clsx";
import { CalendarCheck, CreditCard, QrCode, Users, type LucideIcon } from "lucide-react";

const FEATURES = [
  { icon: Users, text: "Members, plans and renewals in one list" },
  { icon: CreditCard, text: "UPI payments with no gateway fees" },
  { icon: QrCode, text: "QR check-in at the front desk" },
  { icon: CalendarCheck, text: "Classes, workouts and personal training" },
];

// Two-column page for sign-in and gym registration: a dark brand panel on
// large screens, and just the form (with the logo above it) on phones.
// The panel keeps the member app's olive and lime in both themes.
export function AuthShell({ title, subtitle, children, aside }: {
  title?: string;
  subtitle?: ReactNode;
  children: ReactNode;
  aside?: { heading: string; text: string };
}) {
  return (
    <main className="grid flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <section className="relative hidden overflow-hidden bg-[#1f2a10] p-12 text-white lg:flex lg:flex-col">
        <div aria-hidden className="absolute -right-24 -top-24 size-80 rounded-full bg-[#c8f04b]/15 blur-2xl" />
        <div aria-hidden className="absolute -bottom-32 -left-20 size-96 rounded-full bg-[#c8f04b]/10 blur-3xl" />

        <Logo dark />
        <div className="relative my-auto max-w-md space-y-8">
          <div className="space-y-3">
            <h2 className="text-4xl font-semibold leading-tight tracking-tight">
              {aside?.heading ?? "Run your gym from one place"}
            </h2>
            <p className="text-white/70">
              {aside?.text ?? "The admin panel for owners and staff, and an app your members install from a WhatsApp link."}
            </p>
          </div>
          <ul className="space-y-3">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-white/90">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#c8f04b] text-[#1f2a10]">
                  <Icon className="size-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/50">Made for Indian gyms: INR, UPI, +91 and IST by default.</p>
      </section>

      <section className="flex flex-col px-4 py-8 sm:px-8 lg:py-12">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="mx-auto my-auto w-full max-w-sm space-y-6 py-8">
          {title && <AuthHeading title={title} subtitle={subtitle} />}
          {children}
        </div>
      </section>
    </main>
  );
}

export function AuthHeading({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
    </div>
  );
}

function Logo({ dark }: { dark?: boolean }) {
  return (
    <Link href="/" className="relative text-xl font-bold">
      Gym<span className={dark ? "text-[#c8f04b]" : "text-brand"}>OS</span>
    </Link>
  );
}

// Larger input with a leading icon, used on the sign-in and register pages.
export function AuthField({ label, icon: Icon, hint, extra, trailing, children }: {
  label: string;
  icon: LucideIcon;
  hint?: string;
  extra?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        {extra}
      </div>
      <label className="relative block">
        <span className="sr-only">{label}</span>
        <Icon aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        {children}
        {trailing && <span className="absolute right-1.5 top-1/2 -translate-y-1/2">{trailing}</span>}
      </label>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function AuthInput({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={clsx(
        "h-11 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-sm outline-none transition placeholder:text-muted/70 focus:border-brand focus:ring-4 focus:ring-brand/15",
        className,
      )}
      {...props}
    />
  );
}
