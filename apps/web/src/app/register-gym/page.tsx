import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { requireUser } from "@/lib/auth";
import { RegisterGymForm } from "./register-form";

export const metadata: Metadata = { title: "Register your gym" };

export default async function RegisterGymPage() {
  await requireUser("/register-gym");

  return (
    <AuthShell
      title="Register your gym"
      subtitle="You'll be the owner. It starts with Indian defaults (INR, IST, +91); change anything later in Settings."
      aside={{
        heading: "Your gym, live in a minute",
        text: "Pick a name and a link. Share the link on WhatsApp and members join from the app.",
      }}
    >
      <RegisterGymForm siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? ""} />
    </AuthShell>
  );
}
