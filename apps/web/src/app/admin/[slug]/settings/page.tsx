import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { requireGym } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ params }: PageProps<"/admin/[slug]/settings">) {
  const { slug } = await params;
  const { gym } = await requireGym(slug, ["owner", "admin"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("gyms")
    .select("name, address, phone, timezone")
    .eq("id", gym.id)
    .single();

  return (
    <>
      <PageHeader title="Settings" />
      <Card className="max-w-lg">
        <h2 className="mb-4 font-medium">Gym profile</h2>
        <SettingsForm slug={slug} gym={data!} />
      </Card>
    </>
  );
}
