import { requireGym, STAFF_ROLES, TEAM_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminHeader } from "./admin-header";
import { AdminNav, BottomNav } from "./admin-nav";
import { BRAND } from "@gymos/shared";

// People waiting to join and UPI payments to confirm, for the sidebar.
async function waitingCounts(gymId: string) {
  const supabase = await createClient();
  const [joins, upi] = await Promise.all([
    supabase.from("gym_members").select("id", { count: "exact", head: true }).eq("gym_id", gymId).eq("status", "pending"),
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("gym_id", gymId).eq("status", "created"),
  ]);
  return { members: joins.count ?? 0, payments: upi.count ?? 0 };
}

export default async function AdminLayout({ children, params }: LayoutProps<"/admin/[slug]">) {
  const { slug } = await params;
  const { user, ...membership } = await requireGym(slug, TEAM_ROLES, `/admin/${slug}`);
  const { gym, role } = membership;
  const navProps = {
    slug,
    role,
    permissions: [...membership.permissions],
    checkinEnabled: gym.checkin_enabled,
    classesEnabled: gym.classes_enabled,
    workoutsEnabled: gym.workouts_enabled,
    ptEnabled: gym.pt_enabled,
    nutritionEnabled: gym.nutrition_enabled ?? false,
    posterEnabled: gym.checkin_enabled && gym.checkin_poster_enabled,
    counts: STAFF_ROLES.includes(role) ? await waitingCounts(gym.id) : undefined,
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar from tablet width up; phones get the bottom bar instead. */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-border bg-surface md:flex print:hidden">
        <p className="flex h-14 items-center border-b border-border px-5 text-lg font-bold">
          {BRAND.logo[0]}<span className="text-brand">{BRAND.logo[1]}</span>
        </p>
        <div className="flex-1 overflow-y-auto py-2">
          <AdminNav {...navProps} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader membership={membership} user={user} />
        <main className="flex-1 p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:p-8 print:p-0">{children}</main>
      </div>
      <div className="print:hidden">
        <BottomNav {...navProps} />
      </div>
    </div>
  );
}
