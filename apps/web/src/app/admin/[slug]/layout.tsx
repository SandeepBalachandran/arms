import { requireGym, TEAM_ROLES } from "@/lib/auth";
import { AdminHeader } from "./admin-header";
import { AdminNav } from "./admin-nav";

export default async function AdminLayout({ children, params }: LayoutProps<"/admin/[slug]">) {
  const { slug } = await params;
  const { user, ...membership } = await requireGym(slug, TEAM_ROLES, `/admin/${slug}`);
  const { gym, role } = membership;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-border bg-surface md:w-56 md:shrink-0 md:border-r md:border-b-0">
        <p className="hidden h-14 items-center border-b border-border px-5 text-lg font-bold md:flex">
          Gym<span className="text-brand">OS</span>
        </p>
        <div className="py-2">
          <AdminNav
            slug={slug}
            role={role}
            checkinEnabled={gym.checkin_enabled}
            classesEnabled={gym.classes_enabled}
            workoutsEnabled={gym.workouts_enabled}
          />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader membership={membership} user={user} />
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
