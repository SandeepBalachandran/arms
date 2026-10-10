import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requireGym, STAFF_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ImportWizard } from "./import-wizard";

export const metadata: Metadata = { title: "Import members" };

export default async function ImportMembersPage({ params }: PageProps<"/admin/[slug]/members/import">) {
  const { slug } = await params;
  const { gym } = await requireGym(slug, STAFF_ROLES);
  const supabase = await createClient();
  const { data: plans, error } = await supabase
    .from("plans")
    .select("id, name, duration_days")
    .eq("gym_id", gym.id)
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;

  return (
    <>
      <Link href={`/admin/${slug}/members`} className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Members
      </Link>
      <PageHeader title="Import members" />
      <ImportWizard slug={slug} gymSlug={gym.slug} plans={plans} countryCode={gym.phone_country_code} />
    </>
  );
}
