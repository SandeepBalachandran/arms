import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";
import { requireUser, safeNextPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "My profile" };

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const { back } = await searchParams;
  const backHref = safeNextPath(typeof back === "string" ? back : null, "/admin");
  const user = await requireUser("/account");
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("full_name, phone").eq("id", user.id).single();

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-10">
      <Link href={backHref} className="text-sm text-muted hover:underline">← Back</Link>
      <h1 className="mt-2 text-2xl font-semibold">My profile</h1>
      <p className="mt-1 text-sm text-muted">{user.email}</p>
      <Card className="mt-6">
        <ProfileForm fullName={profile?.full_name ?? ""} phone={profile?.phone ?? ""} />
      </Card>
    </main>
  );
}
