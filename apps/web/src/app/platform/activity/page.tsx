import type { Metadata } from "next";
import { ActivityList, parseActivityParams } from "@/components/activity-list";
import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Activity" };

const PAGE = 100;

// Every gym's activity log, newest first (or one gym's with ?gym=<id>).
export default async function PlatformActivityPage({ searchParams }: PageProps<"/platform/activity">) {
  const sp = await searchParams;
  const { group, before } = parseActivityParams(sp);
  const gymId = typeof sp.gym === "string" && /^[0-9a-f-]{36}$/.test(sp.gym) ? sp.gym : null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("audit_entries", {
    // null means every gym (the generated type doesn't know that).
    p_gym_id: gymId as string,
    p_before: before ?? undefined,
    p_limit: PAGE,
  });
  if (error) throw error;

  return (
    <>
      <PageHeader title={gymId && data[0]?.gym_name ? `Activity · ${data[0].gym_name}` : "Activity"} />
      <ActivityList
        rows={data}
        basePath={gymId ? `/platform/activity?gym=${gymId}` : "/platform/activity"}
        group={group}
        forOwner={false}
        showGym={!gymId}
        hasMore={data.length === PAGE}
      />
    </>
  );
}
