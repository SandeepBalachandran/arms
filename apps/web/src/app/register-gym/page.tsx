import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { RegisterGymForm } from "./register-form";

export const metadata: Metadata = { title: "Register your gym" };

export default async function RegisterGymPage() {
  await requireUser("/register-gym");

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
      <h1 className="text-2xl font-semibold">Register your gym</h1>
      <p className="mt-1 text-sm text-muted">You will be the owner. You can invite staff and members afterwards.</p>
      <RegisterGymForm />
    </main>
  );
}
