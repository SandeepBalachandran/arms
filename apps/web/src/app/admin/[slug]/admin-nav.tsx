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
  Link2,
  QrCode,
  ReceiptText,
  History,
  ScanLine,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import type { GymRole, Permission } from "@/lib/auth";

// Optional features (check-in, classes, workouts, PT, nutrition) only show when the gym turns them on.
// `perms`: shown when the person has any of these in the owner's grid.
const ITEMS = [
  { href: "", label: "Dashboard", short: "Home", icon: LayoutDashboard, roles: null },
  { href: "/checkin", label: "Check-in", short: "Check-in", icon: ScanLine, roles: null, perms: ["check_in_members"], needs: "checkin" },
  { href: "/members", label: "Members", short: "Members", icon: Users, roles: null },
  { href: "/classes", label: "Classes", short: "Classes", icon: CalendarDays, roles: null, needs: "classes" },
  { href: "/workouts", label: "Workouts", short: "Workouts", icon: Dumbbell, roles: null, needs: "workouts" },
  { href: "/pt", label: "Personal training", short: "PT", icon: HeartHandshake, roles: null, needs: "pt" },
  { href: "/foods", label: "Nutrition", short: "Food", icon: Apple, roles: null, needs: "nutrition" },
  { href: "/plans", label: "Plans", short: "Plans", icon: CreditCard, roles: null },
  { href: "/payments", label: "Payments", short: "Payments", icon: ReceiptText, roles: ["owner", "admin", "staff"] },
  { href: "/join", label: "Join link", short: "Join", icon: Link2, roles: null, perms: ["manage_members"], group: "gym" },
  { href: "/settings", label: "Settings", short: "Settings", icon: Settings, roles: null, perms: ["edit_gym_settings", "manage_sections"], group: "gym" },
  { href: "/activity", label: "Activity", short: "Activity", icon: History, roles: ["owner"], group: "gym" },
  { href: "/roles", label: "Roles & permissions", short: "Roles", icon: ShieldCheck, roles: ["owner"], group: "gym" },
  { href: "/checkin/poster", label: "QR poster", short: "Poster", icon: QrCode, roles: null, perms: ["check_in_members"], needs: "poster", group: "gym" },
] as const;

// Order for the phone bottom bar: the first four that apply get a tab, the rest go under "More".
const BOTTOM_PRIORITY = ["", "/members", "/checkin", "/payments", "/classes", "/plans", "/pt", "/workouts", "/foods", "/settings", "/join", "/activity", "/roles", "/checkin/poster"];

type NavProps = {
  slug: string;
  role: GymRole;
  permissions: Permission[];
  checkinEnabled: boolean;
  classesEnabled: boolean;
  workoutsEnabled: boolean;
  ptEnabled: boolean;
  nutritionEnabled: boolean;
  posterEnabled: boolean;
  // Red counts beside Members (people waiting to join) and Payments (UPI to confirm).
  counts?: { members: number; payments: number };
};

type Item = (typeof ITEMS)[number];

function useNav({ slug, role, permissions, checkinEnabled, classesEnabled, workoutsEnabled, ptEnabled, nutritionEnabled, posterEnabled }: NavProps) {
  const pathname = usePathname();
  const base = `/admin/${slug}`;
  const enabled = { checkin: checkinEnabled, classes: classesEnabled, workouts: workoutsEnabled, pt: ptEnabled, nutrition: nutritionEnabled, poster: posterEnabled };
  const items = ITEMS.filter(
    (i) =>
      (!i.roles || (i.roles as readonly GymRole[]).includes(role)) &&
      (!("perms" in i) || (i.perms as readonly Permission[]).some((p) => permissions.includes(p))) &&
      (!("needs" in i) || enabled[i.needs]),
  );
  // The longest matching link wins, so the poster page doesn't also light up Check-in.
  const active = items
    .filter((i) => (i.href ? pathname.startsWith(base + i.href) : pathname === base))
    .sort((a, b) => b.href.length - a.href.length)[0];
  const isActive = (i: Item) => i === active;
  return { items, base, isActive };
}

function countFor(i: Item, counts: NavProps["counts"]) {
  return i.href === "/members" ? counts?.members : i.href === "/payments" ? counts?.payments : 0;
}

// Sidebar (tablet and desktop).
export function AdminNav(props: NavProps) {
  const { items, base, isActive } = useNav(props);
  const link = (i: Item) => {
    const count = countFor(i, props.counts);
    return (
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
        {!!count && (
          <span className="ml-auto rounded-full bg-danger px-1.5 text-[10.5px] font-bold text-white" aria-label={`${count} waiting`}>
            {count}
          </span>
        )}
      </Link>
    );
  };
  const main = items.filter((i) => !("group" in i));
  const gym = items.filter((i) => "group" in i);
  return (
    <nav className="flex flex-col gap-1 px-2" aria-label="Admin">
      {main.map(link)}
      {gym.length > 0 && <p className="px-3 pt-4 pb-1 text-[10.5px] font-medium tracking-widest text-muted uppercase">Gym</p>}
      {gym.map(link)}
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
