import type { Metadata } from "next";
import Link from "next/link";
import { safeNextPath } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, mode } = await searchParams;
  const nextPath = safeNextPath(typeof next === "string" ? next : null, "/admin");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <Link href="/" className="text-xl font-bold">
        Gym<span className="text-brand">OS</span>
      </Link>
      <LoginForm next={nextPath} initialMode={mode === "signup" ? "signup" : "signin"} />
    </main>
  );
}
