import type { Metadata } from "next";
import { BRAND } from "@gymos/shared";
import { ActivityList, parseActivityParams } from "@/components/activity-list";
import { PageHeader } from "@/components/ui";
import { requireGym } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Activity" };

const PAGE = 100;

// Owner only: who did what at the gym (payments, memberships, people and
// roles, the permission grid, plans and settings), from the database's log.
export default async function ActivityPage({ params, searchParams }: PageProps<"/admin/[slug]/activity">) {
  const { slug } = await params;
  const { gym } = await requireGym(slug, ["owner"]);
  const { group, before } = parseActivityParams(await searchParams);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("audit_entries", { p_gym_id: gym.id, p_before: before ?? undefined, p_limit: PAGE });
  if (error) throw error;

  return (
    <>
      <PageHeader title="Activity" />
      <p className="-mt-4 mb-4 max-w-2xl text-sm text-muted">
        Everything important your team does: payments, memberships, people and roles, permissions, plans and settings. Nobody can
        change or delete these entries. When {BRAND.name} support looks at your gym, that shows here too.
      </p>
      <ActivityList
        rows={data}
        basePath={`/admin/${slug}/activity`}
        group={group}
        forOwner
        currency={gym.currency}
        timezone={gym.timezone}
        hasMore={data.length === PAGE}
      />
    </>
  );
}
