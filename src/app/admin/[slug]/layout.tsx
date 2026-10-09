import Link from "next/link";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { requireGym, TEAM_ROLES } from "@/lib/auth";
import { AdminNav } from "./admin-nav";

export default async function AdminLayout({ children, params }: LayoutProps<"/admin/[slug]">) {
  const { slug } = await params;
  const { gym, role, user } = await requireGym(slug, TEAM_ROLES, `/admin/${slug}`);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-border bg-surface md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex items-center justify-between p-4 md:block">
          <Link href={`/admin/${slug}`} className="block font-semibold">{gym.name}</Link>
          <p className="text-xs capitalize text-muted">{role} · {user.fullName || user.email}</p>
        </div>
        <AdminNav slug={slug} role={role} />
        <form action={signOut} className="hidden p-2 md:block">
          <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-border/40">
            <LogOut className="size-4" /> Sign out
          </button>
        </form>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
