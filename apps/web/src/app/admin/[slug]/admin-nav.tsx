"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { LayoutDashboard, Settings, Users } from "lucide-react";
import type { GymRole } from "@/lib/auth";

// Later phases add Plans, Check-in, Classes, Workouts and Reports here.
const ITEMS = [
  { href: "", label: "Dashboard", icon: LayoutDashboard, roles: null },
  { href: "/members", label: "Members", icon: Users, roles: null },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["owner", "admin"] },
] as const;

export function AdminNav({ slug, role }: { slug: string; role: GymRole }) {
  const pathname = usePathname();
  const base = `/admin/${slug}`;

  return (
    <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-0">
      {ITEMS.filter((i) => !i.roles || (i.roles as readonly GymRole[]).includes(role)).map(
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
