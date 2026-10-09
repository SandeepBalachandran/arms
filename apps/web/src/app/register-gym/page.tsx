import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { RegisterGymForm } from "./register-form";

export const metadata: Metadata = { title: "Register your gym" };

export default async function RegisterGymPage() {
  await requireUser("/register-gym");

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
      <h1 className="text-2xl font-semibold">Register your gym</h1>
      <p className="mt-1 text-sm text-muted">You will be the owner. The gym starts with Indian defaults (INR, IST, +91); change anything later in Settings.</p>
      <RegisterGymForm />
    </main>
  );
}
