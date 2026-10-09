"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { CreditCard, LayoutDashboard, ReceiptIndianRupee, ScanLine, Settings, Users } from "lucide-react";
import type { GymRole } from "@/lib/auth";

// Later phases add Classes, Workouts and Reports here.
const ITEMS = [
  { href: "", label: "Dashboard", icon: LayoutDashboard, roles: null },
  { href: "/checkin", label: "Check-in", icon: ScanLine, roles: ["owner", "admin", "staff"], needsCheckin: true },
  { href: "/members", label: "Members", icon: Users, roles: null },
  { href: "/plans", label: "Plans", icon: CreditCard, roles: null },
  { href: "/payments", label: "Payments", icon: ReceiptIndianRupee, roles: ["owner", "admin", "staff"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["owner", "admin"] },
] as const;

export function AdminNav({ slug, role, checkinEnabled }: { slug: string; role: GymRole; checkinEnabled: boolean }) {
  const pathname = usePathname();
  const base = `/admin/${slug}`;

  return (
    <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-0">
      {ITEMS.filter(
        (i) =>
          (!i.roles || (i.roles as readonly GymRole[]).includes(role)) &&
          (!("needsCheckin" in i) || checkinEnabled),
      ).map(
        ({ href, label, icon: Icon }) => {
          const target = base + href;
          const active = href ? pathname.startsWith(target) : pathname === base;
          return (
            <Link
              key={label}
              href={target}
              className={clsx(
                "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm",
                active ? "bg-brand/15 font-medium text-foreground" : "text-muted hover:bg-border/40",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        },
      )}
    </nav>
  );
}
