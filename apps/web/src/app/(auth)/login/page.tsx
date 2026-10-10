import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { safeNextPath } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, mode, error } = await searchParams;
  const nextPath = safeNextPath(typeof next === "string" ? next : null, "/admin");

  return (
    <AuthShell>
      <LoginForm
        next={nextPath}
        initialMode={mode === "signup" ? "signup" : "signin"}
        // Set by /auth/callback when an email link is used twice or has expired.
        linkError={error === "link"}
      />
    </AuthShell>
  );
}
