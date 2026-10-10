import { requireGym, TEAM_ROLES } from "@/lib/auth";
import { AdminHeader } from "./admin-header";
import { AdminNav, BottomNav } from "./admin-nav";

export default async function AdminLayout({ children, params }: LayoutProps<"/admin/[slug]">) {
  const { slug } = await params;
  const { user, ...membership } = await requireGym(slug, TEAM_ROLES, `/admin/${slug}`);
  const { gym, role } = membership;
  const navProps = {
    slug,
    role,
    checkinEnabled: gym.checkin_enabled,
    classesEnabled: gym.classes_enabled,
    workoutsEnabled: gym.workouts_enabled,
    ptEnabled: gym.pt_enabled,
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar from tablet width up; phones get the bottom bar instead. */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <p className="flex h-14 items-center border-b border-border px-5 text-lg font-bold">
          G<span className="text-brand">OS</span>
        </p>
        <div className="flex-1 overflow-y-auto py-2">
          <AdminNav {...navProps} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader membership={membership} user={user} />
        <main className="flex-1 p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:p-8">{children}</main>
      </div>
      <BottomNav {...navProps} />
    </div>
  );
}
