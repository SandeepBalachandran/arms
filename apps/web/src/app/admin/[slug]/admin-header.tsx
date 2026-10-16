import Link from "next/link";
import { Bell, Check, ChevronDown, LogOut, Plus, Settings, UserRound } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { initials } from "@gymos/shared";
import { Avatar } from "@/components/avatar";
import { Dropdown, MenuSection } from "@/components/dropdown";
import { PushAlerts } from "@/components/push-alerts";
import { menuItemClass } from "@/components/menu-styles";
import { ThemeSwitch } from "@/components/theme-toggle";
import { signAvatar } from "@/lib/avatars";
import { getMyGyms, getMyPermissions, STAFF_ROLES, TEAM_ROLES, type CurrentUser, type GymMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getTheme } from "@/lib/theme";

// Top bar of the admin panel: gym name on the left; notifications and the
// profile menu (account, gym switcher, appearance, sign out) on the right.
export async function AdminHeader({ membership, user }: { membership: GymMembership; user: CurrentUser }) {
  const { gym, role } = membership;
  const isStaff = STAFF_ROLES.includes(role);
  const permissions = await getMyPermissions(gym.id);
  const canConfigure = permissions.has("edit_gym_settings") || permissions.has("manage_sections");
  const displayName = user.fullName || user.email || "Account";
  const supabase = await createClient();

  const [gyms, theme, upi, joins, photo] = await Promise.all([
    getMyGyms(),
    getTheme(),
    isStaff
      ? supabase.from("payments").select("id", { count: "exact", head: true }).eq("gym_id", gym.id).eq("status", "created")
      : Promise.resolve({ count: 0 }),
    isStaff
      ? supabase.from("gym_members").select("id", { count: "exact", head: true }).eq("gym_id", gym.id).eq("status", "pending")
      : Promise.resolve({ count: 0 }),
    signAvatar(user.avatarPath),
  ]);
  const teamGyms = gyms.filter((m) => TEAM_ROLES.includes(m.role));
  const notifications = [
    upi.count && { href: `/admin/${gym.slug}/payments`, text: `${upi.count} UPI ${upi.count === 1 ? "payment" : "payments"} to confirm` },
    joins.count && { href: `/admin/${gym.slug}/members`, text: `${joins.count} ${joins.count === 1 ? "person" : "people"} waiting for approval` },
  ].filter((n): n is { href: string; text: string } => Boolean(n));

  return (
    <header className="sticky top-0 z-20 flex h-14 print:hidden items-center justify-between gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur md:px-8">
      <Link href={`/admin/${gym.slug}`} className="flex min-w-0 items-center gap-2.5 font-semibold">
        {gym.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- user upload on Supabase Storage
          <img src={gym.logo_url} alt="" className="size-8 shrink-0 rounded-lg object-cover" />
        ) : (
          <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#1f2a10] text-xs font-extrabold text-[#c8f04b]">
            {initials(gym.name)}
          </span>
        )}
        <span className="truncate">{gym.name}</span>
      </Link>

      <div className="flex items-center gap-1">
        <Dropdown
          label={notifications.length ? `Notifications, ${notifications.length} new` : "Notifications"}
          tooltip="Notifications"
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
          <MenuSection title="Notifications">
            {notifications.length === 0 ? (
              <p className="px-4 py-2 text-sm text-muted">You&apos;re all caught up.</p>
            ) : (
              notifications.map((n) => (
                <Link key={n.href} href={n.href} role="menuitem" className={menuItemClass}>
                  <span className="size-2 shrink-0 rounded-full bg-danger" aria-hidden />
                  {n.text}
                </Link>
              ))
            )}
          </MenuSection>
          {permissions.has("confirm_upi") && <PushAlerts />}
        </Dropdown>

        <Dropdown
          label="Account menu"
          tooltip="Account"
          trigger={
            <span className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-border/40">
              <Avatar name={displayName} src={photo} />
              <span className="hidden max-w-36 truncate text-sm font-medium sm:block">{displayName}</span>
              <ChevronDown className="hidden size-4 text-muted sm:block" />
            </span>
          }
        >
          <div className="flex items-center gap-3 px-4 pb-3 pt-2">
            <Avatar name={displayName} src={photo} size="md" />
            <div className="min-w-0">
              <p className="truncate font-medium">{user.fullName || "Add your name"}</p>
              <p className="truncate text-sm text-muted">{user.email}</p>
              <span className="mt-1 inline-block rounded-full bg-brand/15 px-2 py-0.5 text-xs font-medium capitalize">
                {role}
              </span>
            </div>
          </div>

          <MenuSection>
            <Link href={`/admin/${gym.slug}/profile`} role="menuitem" className={menuItemClass}>
              <UserRound className="size-4 text-muted" /> My profile
            </Link>
            {canConfigure && (
              <Link href={`/admin/${gym.slug}/settings`} role="menuitem" className={menuItemClass}>
                <Settings className="size-4 text-muted" /> Gym settings
              </Link>
            )}
          </MenuSection>

          <MenuSection title={teamGyms.length > 1 ? "Your gyms" : undefined}>
            {teamGyms.length > 1 &&
              teamGyms.map((m) => (
                <Link key={m.gym.id} href={`/admin/${m.gym.slug}`} role="menuitem" className={menuItemClass}>
                  <Avatar name={m.gym.name} size="xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{m.gym.name}</span>
                    <span className="block text-xs capitalize text-muted">{m.role}</span>
                  </span>
                  {m.gym.id === gym.id && <Check className="size-4 text-brand" aria-label="Current gym" />}
                </Link>
              ))}
            <Link href="/register-gym" role="menuitem" className={menuItemClass}>
              <Plus className="size-4 text-muted" /> Register a new gym
            </Link>
          </MenuSection>

          <MenuSection>
            <ThemeSwitch initial={theme} />
          </MenuSection>

          <MenuSection>
            <form action={signOut}>
              <button role="menuitem" className={`${menuItemClass} text-danger`}>
                <LogOut className="size-4" /> Sign out
              </button>
            </form>
          </MenuSection>
        </Dropdown>
      </div>
    </header>
  );
}
