"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  Apple,
  CalendarDays,
  CreditCard,
  Dumbbell,
  HeartHandshake,
  LayoutDashboard,
  MoreHorizontal,
  ReceiptText,
  ScanLine,
  Settings,
  Users,
  X,
} from "lucide-react";
import type { GymRole } from "@/lib/auth";

// Optional features (check-in, classes, workouts, PT, nutrition) only show when the gym turns them on.
const ITEMS = [
  { href: "", label: "Dashboard", short: "Home", icon: LayoutDashboard, roles: null },
  { href: "/checkin", label: "Check-in", short: "Check-in", icon: ScanLine, roles: ["owner", "admin", "staff"], needs: "checkin" },
  { href: "/members", label: "Members", short: "Members", icon: Users, roles: null },
  { href: "/classes", label: "Classes", short: "Classes", icon: CalendarDays, roles: null, needs: "classes" },
  { href: "/workouts", label: "Workouts", short: "Workouts", icon: Dumbbell, roles: null, needs: "workouts" },
  { href: "/pt", label: "Personal training", short: "PT", icon: HeartHandshake, roles: null, needs: "pt" },
  { href: "/foods", label: "Foods", short: "Foods", icon: Apple, roles: null, needs: "nutrition" },
  { href: "/plans", label: "Plans", short: "Plans", icon: CreditCard, roles: null },
  { href: "/payments", label: "Payments", short: "Payments", icon: ReceiptText, roles: ["owner", "admin", "staff"] },
  { href: "/settings", label: "Settings", short: "Settings", icon: Settings, roles: ["owner", "admin"] },
] as const;

// Order for the phone bottom bar: the first four that apply get a tab, the rest go under "More".
const BOTTOM_PRIORITY = ["", "/members", "/checkin", "/payments", "/classes", "/plans", "/pt", "/workouts", "/foods", "/settings"];

type NavProps = {
  slug: string;
  role: GymRole;
  checkinEnabled: boolean;
  classesEnabled: boolean;
  workoutsEnabled: boolean;
  ptEnabled: boolean;
  nutritionEnabled: boolean;
};

type Item = (typeof ITEMS)[number];

function useNav({ slug, role, checkinEnabled, classesEnabled, workoutsEnabled, ptEnabled, nutritionEnabled }: NavProps) {
  const pathname = usePathname();
  const base = `/admin/${slug}`;
  const enabled = { checkin: checkinEnabled, classes: classesEnabled, workouts: workoutsEnabled, pt: ptEnabled, nutrition: nutritionEnabled };
  const items = ITEMS.filter(
    (i) => (!i.roles || (i.roles as readonly GymRole[]).includes(role)) && (!("needs" in i) || enabled[i.needs]),
  );
  const isActive = (i: Item) => (i.href ? pathname.startsWith(base + i.href) : pathname === base);
  return { items, base, isActive };
}

// Sidebar (tablet and desktop).
export function AdminNav(props: NavProps) {
  const { items, base, isActive } = useNav(props);
  return (
    <nav className="flex flex-col gap-1 px-2" aria-label="Admin">
      {items.map((i) => (
        <Link
          key={i.label}
          href={base + i.href}
          aria-current={isActive(i) ? "page" : undefined}
          className={clsx(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
            isActive(i) ? "bg-brand/15 font-medium text-foreground" : "text-muted hover:bg-border/40",
          )}
        >
          <i.icon className="size-4" />
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

// Bottom tab bar (phones): four main sections plus "More" for the rest.
export function BottomNav(props: NavProps) {
  const { items, base, isActive } = useNav(props);
  const [moreOpen, setMoreOpen] = useState(false);
  const close = () => setMoreOpen(false);

  const ordered = [...items].sort((a, b) => BOTTOM_PRIORITY.indexOf(a.href) - BOTTOM_PRIORITY.indexOf(b.href));
  const tabs = ordered.length <= 5 ? ordered : ordered.slice(0, 4);
  const more = ordered.length <= 5 ? [] : ordered.slice(4);
  const moreActive = more.some(isActive);

  const tabClass = (active: boolean) =>
    clsx(
      "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
      active ? "text-brand" : "text-muted",
    );

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMoreOpen(false)} aria-hidden />
      )}
      {moreOpen && (
        <div
          role="dialog"
          aria-label="More sections"
          className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-border bg-surface pb-[calc(4rem+env(safe-area-inset-bottom))] md:hidden"
        >
          <div className="flex items-center justify-between px-5 py-3">
            <p className="font-semibold">More</p>
            <button type="button" onClick={() => setMoreOpen(false)} aria-label="Close" className="rounded-lg p-1 text-muted">
              <X className="size-5" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 px-4 pb-4">
            {more.map((i) => (
              <Link
                key={i.label}
                href={base + i.href}
                aria-current={isActive(i) ? "page" : undefined}
                onClick={close}
                className={clsx(
                  "flex flex-col items-center gap-1 rounded-xl border p-3 text-sm",
                  isActive(i) ? "border-brand bg-brand/10 font-medium" : "border-border",
                )}
              >
                <i.icon className="size-5" />
                {i.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      <nav
        aria-label="Admin"
        className="fixed inset-x-0 bottom-0 z-50 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {tabs.map((i) => (
          <Link
            key={i.label}
            href={base + i.href}
            aria-current={isActive(i) ? "page" : undefined}
            onClick={close}
            className={tabClass(isActive(i))}
          >
            <i.icon className="size-5" />
            {i.short}
          </Link>
        ))}
        {more.length > 0 && (
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            aria-expanded={moreOpen}
            className={tabClass(moreActive || moreOpen)}
          >
            <MoreHorizontal className="size-5" />
            More
          </button>
        )}
      </nav>
    </>
  );
}
