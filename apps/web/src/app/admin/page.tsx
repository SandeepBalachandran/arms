import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { GymPicker } from "@/components/gym-picker";
import { Card } from "@/components/ui";
import { getMyGyms, requireUser, TEAM_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { restoreGym } from "./[slug]/settings/delete-actions";

export const metadata: Metadata = { title: "Admin" };

const KEEP_DAYS = 30;

export default async function AdminIndex({ searchParams }: PageProps<"/admin">) {
  const user = await requireUser("/admin");
  const { deleted } = await searchParams;
  // Gyms this user owns that were deleted in the last 30 days and can be restored.
  const supabase = await createClient();
  const { data: restorable } = await supabase
    .from("gym_members")
    .select("gyms!inner(id, name, slug, deleted_at)")
    .eq("user_id", user.id)
    .eq("role", "owner")
    .eq("status", "active")
    .not("gyms.deleted_at", "is", null);
  const recentlyDeleted = (restorable ?? []).map((r) => r.gyms);
  // Right after a delete the cached gym list (loaded by the delete action in
  // this same request) still has the deleted gym, so leave it out here.
  const deletedIds = new Set(recentlyDeleted.map((g) => g.id));
  const gyms = (await getMyGyms()).filter((m) => TEAM_ROLES.includes(m.role) && !deletedIds.has(m.gym.id));

  if (gyms.length === 1 && !recentlyDeleted.length && !deleted) redirect(`/admin/${gyms[0].gym.slug}`);

  return (
    <>
      <GymPicker
        title="Choose a gym to manage"
        gyms={gyms}
        hrefPrefix="/admin"
        notice={typeof deleted === "string" ? `${deleted} was deleted. You can restore it below for ${KEEP_DAYS} days.` : undefined}
        empty={
          <>
            You don&apos;t manage any gyms yet.{" "}
            <Link href="/register-gym" className="text-brand hover:underline">Register your gym</Link>
          </>
        }
      >
        {recentlyDeleted.length > 0 && (
          <section className="mt-8 space-y-2">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted">Recently deleted</h2>
            {recentlyDeleted.map((g) => (
              <Card key={g.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{g.name}</p>
                  <p className="text-xs text-muted">Deleted for good in {daysLeft(g.deleted_at!)}</p>
                </div>
                <ActionForm action={restoreGym} success={`${g.name} restored`}>
                  <input type="hidden" name="gym_id" value={g.id} />
                  <input type="hidden" name="slug" value={g.slug} />
                  <button className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-border/40">
                    <RotateCcw className="size-4" /> Restore
                  </button>
                </ActionForm>
              </Card>
            ))}
          </section>
        )}
      </GymPicker>
    </>
  );
}

function daysLeft(deletedAt: string) {
  const days = Math.max(0, Math.ceil(KEEP_DAYS - (Date.now() - new Date(deletedAt).getTime()) / 86_400_000));
  return days === 1 ? "1 day" : `${days} days`;
}
