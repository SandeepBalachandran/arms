import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Building2, Check, LogOut, Plus } from "lucide-react";
import { ProfileForm } from "@/app/account/profile-form";
import { signOut } from "@/app/(auth)/actions";
import { ThemeSwitch } from "@/components/theme-toggle";
import { Card, PageHeader } from "@/components/ui";
import { getMyGyms, requireGym, TEAM_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getTheme } from "@/lib/theme";
import { signOutEverywhere } from "./actions";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "My profile" };

function initials(text: string) {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase();
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card>
      <h2 className="font-medium">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-4 max-w-xl">{children}</div>
    </Card>
  );
}

// The signed-in user's own account, inside the admin shell.
export default async function ProfilePage({ params }: PageProps<"/admin/[slug]/profile">) {
  const { slug } = await params;
  const { user, gym } = await requireGym(slug, TEAM_ROLES);
  const supabase = await createClient();
  const [{ data: profile }, gyms, theme, { data: auth }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone, created_at").eq("id", user.id).single(),
    getMyGyms(),
    getTheme(),
    supabase.auth.getUser(),
  ]);
  const displayName = profile?.full_name || user.email || "You";
  const providers = auth.user?.app_metadata?.providers as string[] | undefined;
  const lastSignIn = auth.user?.last_sign_in_at;

  return (
    <>
      <PageHeader title="My profile" />
      <div className="max-w-4xl space-y-6">
        <Card className="flex flex-wrap items-center gap-4">
          <span className="flex size-16 items-center justify-center rounded-full bg-brand text-xl font-bold text-brand-fg">
            {initials(displayName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-semibold">{profile?.full_name || "Add your name"}</p>
            <p className="truncate text-sm text-muted">{user.email}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {gyms.map((m) => (
                <span key={m.gym.id} className="rounded-full bg-border/50 px-2 py-0.5 text-xs">
                  <span className="capitalize">{m.role}</span> · {m.gym.name}
                </span>
              ))}
            </div>
          </div>
        </Card>

        <Section title="Personal details" description="Your name and phone are shown to the gyms you belong to.">
          <ProfileForm fullName={profile?.full_name ?? ""} phone={profile?.phone ?? ""} />
        </Section>

        <Section
          title="Sign-in & security"
          description="Sign in with an email code, or set a password for quicker sign-in."
        >
          <dl className="mb-4 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Email</dt>
              <dd className="truncate">{user.email}</dd>
            </div>
            <div>
              <dt className="text-muted">Last signed in</dt>
              <dd>
                {lastSignIn
                  ? new Date(lastSignIn).toLocaleString("en-IN", { timeZone: gym.timezone, dateStyle: "medium", timeStyle: "short" })
                  : "—"}
              </dd>
            </div>
            {providers && providers.length > 0 && (
              <div>
                <dt className="text-muted">Sign-in methods</dt>
                <dd className="capitalize">{providers.join(", ")}</dd>
              </div>
            )}
          </dl>
          <PasswordForm />
          <form action={signOutEverywhere} className="mt-4 border-t border-border pt-4">
            <p className="mb-2 text-sm text-muted">Lost a phone or used a shared computer? Sign out of GymOS on every device.</p>
            <button className="rounded-lg border border-border px-3 py-1.5 text-sm text-danger hover:bg-danger/10">
              Sign out everywhere
            </button>
          </form>
        </Section>

        <Section title="Your gyms" description="Gyms you manage or train at.">
          <ul className="divide-y divide-border">
            {gyms.map((m) => {
              const href = TEAM_ROLES.includes(m.role) ? `/admin/${m.gym.slug}` : null;
              return (
                <li key={m.gym.id} className="flex items-center gap-3 py-2 text-sm">
                  <Building2 className="size-4 shrink-0 text-muted" />
                  <span className="min-w-0 flex-1">
                    {href ? (
                      <Link href={href} className="font-medium hover:underline">{m.gym.name}</Link>
                    ) : (
                      <span className="font-medium">{m.gym.name}</span>
                    )}
                    <span className="block text-xs capitalize text-muted">{m.role}</span>
                  </span>
                  {m.gym.id === gym.id && <Check className="size-4 text-brand" aria-label="Current gym" />}
                </li>
              );
            })}
          </ul>
          <Link href="/register-gym" className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
            <Plus className="size-4" /> Register a new gym
          </Link>
        </Section>

        <Section title="Preferences">
          <div className="-mx-4 -my-2">
            <ThemeSwitch initial={theme} />
          </div>
        </Section>

        <form action={signOut}>
          <button className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-border/40">
            <LogOut className="size-4" /> Sign out
          </button>
        </form>
      </div>
    </>
  );
}
