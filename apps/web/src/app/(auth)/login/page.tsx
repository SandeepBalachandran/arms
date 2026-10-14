import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { safeNextPath } from "@/lib/auth";
import { InstallBanner } from "@/components/install-banner";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, mode, error, deleted } = await searchParams;
  const nextPath = safeNextPath(typeof next === "string" ? next : null, "/go");

  return (
    <AuthShell>
      {deleted === "1" && (
        <p role="status" className="mb-4 rounded-lg border border-border bg-border/30 px-3 py-2 text-sm">
          Your account has been deleted.
        </p>
      )}
      <InstallBanner />
      <LoginForm
        next={nextPath}
        initialMode={mode === "signup" ? "signup" : "signin"}
        // Set by /auth/callback when an email link is used twice or has expired.
        linkError={error === "link"}
      />
    </AuthShell>
  );
}
