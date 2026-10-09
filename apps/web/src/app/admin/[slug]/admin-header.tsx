import Link from "next/link";
import { Bell, Building2, Check, LogOut, Plus, UserRound } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { Dropdown, menuItemClass } from "@/components/dropdown";
import { ThemeToggle } from "@/components/theme-toggle";
import { getMyGyms, STAFF_ROLES, TEAM_ROLES, type CurrentUser, type GymMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getTheme } from "@/lib/theme";

function initials(name: string, email: string | null) {
  const source = name.trim() || email || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : source.slice(0, 2)).toUpperCase();
}

// Top bar of the admin panel: gym name on the left; notifications and the
// profile menu (account, gym switcher, theme, sign out) on the right.
export async function AdminHeader({ membership, user }: { membership: GymMembership; user: CurrentUser }) {
  const { gym, role } = membership;
  const isStaff = STAFF_ROLES.includes(role);
  const supabase = await createClient();

  const [gyms, theme, upi, joins] = await Promise.all([
    getMyGyms(),
    getTheme(),
    isStaff
      ? supabase.from("payments").select("id", { count: "exact", head: true }).eq("gym_id", gym.id).eq("status", "created")
      : Promise.resolve({ count: 0 }),
    isStaff
      ? supabase.from("gym_members").select("id", { count: "exact", head: true }).eq("gym_id", gym.id).eq("status", "pending")
      : Promise.resolve({ count: 0 }),
  ]);
  const teamGyms = gyms.filter((m) => TEAM_ROLES.includes(m.role));
  const notifications = [
    upi.count && { href: `/admin/${gym.slug}/payments`, text: `${upi.count} UPI ${upi.count === 1 ? "payment" : "payments"} to confirm` },
    joins.count && { href: `/admin/${gym.slug}/members`, text: `${joins.count} ${joins.count === 1 ? "person" : "people"} waiting for approval` },
  ].filter((n): n is { href: string; text: string } => Boolean(n));

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur md:px-8">
      <Link href={`/admin/${gym.slug}`} className="truncate font-semibold">
        {gym.name}
      </Link>

      <div className="flex items-center gap-2">
        <Dropdown
          label={notifications.length ? `${notifications.length} notifications` : "Notifications"}
          trigger={
            <span className="relative flex size-9 items-center justify-center rounded-full text-muted hover:bg-border/40">
              <Bell className="size-5" />
              {notifications.length > 0 && (
                <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-danger text-[10px] font-semibold text-white">
                  {notifications.length}
                </span>
              )}
            </span>
          }
        >
          <p className="border-b border-border px-4 py-2 text-xs font-medium uppercase text-muted">Notifications</p>
          {notifications.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">You&apos;re all caught up.</p>
          ) : (
            notifications.map((n) => (
              <Link key={n.href} href={n.href} role="menuitem" className={menuItemClass}>
                {n.text}
              </Link>
            ))
          )}
        </Dropdown>

        <Dropdown
          label="Account menu"
          trigger={
            <span className="flex size-9 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-fg">
              {initials(user.fullName, user.email)}
            </span>
          }
        >
          <div className="border-b border-border px-4 py-3">
            <p className="truncate font-medium">{user.fullName || "No name yet"}</p>
            <p className="truncate text-sm text-muted">{user.email}</p>
            <p className="mt-1 text-xs capitalize text-muted">{role} at {gym.name}</p>
          </div>
          <Link href={`/account?back=/admin/${gym.slug}`} role="menuitem" className={menuItemClass}>
            <UserRound className="size-4" /> My profile
          </Link>
          {teamGyms.length > 1 && (
            <div className="border-t border-border py-1">
              <p className="px-4 py-1 text-xs font-medium uppercase text-muted">Switch gym</p>
              {teamGyms.map((m) => (
                <Link key={m.gym.id} href={`/admin/${m.gym.slug}`} role="menuitem" className={menuItemClass}>
                  {m.gym.id === gym.id ? <Check className="size-4 text-brand" /> : <Building2 className="size-4 text-muted" />}
                  <span className="truncate">{m.gym.name}</span>
                </Link>
              ))}
            </div>
          )}
          <Link href="/register-gym" role="menuitem" className={`${menuItemClass} border-t border-border`}>
            <Plus className="size-4" /> Register another gym
          </Link>
          <ThemeToggle initial={theme} className={menuItemClass} />
          <form action={signOut} className="border-t border-border">
            <button role="menuitem" className={`${menuItemClass} text-danger`}>
              <LogOut className="size-4" /> Sign out
            </button>
          </form>
        </Dropdown>
      </div>
    </header>
  );
}
