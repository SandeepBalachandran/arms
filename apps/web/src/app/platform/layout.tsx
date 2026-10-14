import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@gymos/shared";
import { signOut } from "@/app/(auth)/actions";
import { requirePlatformAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: { default: "Platform", template: `%s · Platform · ${BRAND.name}` } };

const NAV = [
  { href: "/platform", label: "Gyms" },
  { href: "/platform/people", label: "People" },
  { href: "/platform/activity", label: "Activity" },
];

// The developers' view of every gym. Only platform admins (profiles.is_platform_admin);
// opening a gym's details is logged in that gym's Activity.
export default async function PlatformLayout({ children }: LayoutProps<"/platform">) {
  const user = await requirePlatformAdmin();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 px-4">
          <Link href="/platform" className="flex h-14 shrink-0 items-center text-lg font-bold">
            {BRAND.logo[0]}
            <span className="text-brand">{BRAND.logo[1]}</span>
            <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-amber-700 uppercase dark:text-amber-400">
              Platform
            </span>
          </Link>
          {/* Phones: the links get their own row under the logo. */}
          <nav className="order-last -mx-1 flex w-full gap-1 pb-2 text-sm md:order-none md:mx-0 md:w-auto md:flex-1 md:pb-0">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="shrink-0 rounded-lg px-3 py-1.5 hover:bg-border/40">
                {n.label}
              </Link>
            ))}
          </nav>
          <form action={signOut} className="ml-auto shrink-0">
            <button className="text-sm text-muted hover:text-foreground" title={user.email ?? undefined}>
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
