import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMoney, rolesLabel, type GymRole } from "@gymos/shared";
import { ActivityList, type ActivityRow } from "@/components/activity-list";
import { Badge, Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { ago, date } from "../../format";
import { StatusActions } from "./status-actions";

export const metadata: Metadata = { title: "Gym" };

type GymDetail = {
  gym: {
    id: string;
    name: string;
    slug: string;
    status: string;
    deleted_at: string | null;
    platform_plan: string;
    currency: string;
    timezone: string;
    phone: string | null;
    address: string | null;
    created_at: string;
    sections: Record<string, boolean>;
  };
  team: { name: string; email: string; phone: string | null; role: GymRole; extra_roles: GymRole[]; status: string; last_sign_in_at: string | null }[];
  counts: Record<"members" | "pending_joins" | "pending_upi" | "checkins_30d" | "classes_30d" | "workouts_30d", number>;
  months: { month: string; paise: number; payments: number; cash_paise: number; upi_paise: number }[];
};

const SECTION_LABELS: Record<string, string> = {
  checkin: "Check-in",
  classes: "Classes",
  workouts: "Workouts",
  pt: "PT",
  nutrition: "Nutrition",
  upi: "UPI",
  join_approval: "Join approval",
};

// One gym, for support: who runs it, how it's used, money by month and its
// activity. Opening this page is logged in the gym's own Activity.
export default async function PlatformGymPage({ params }: PageProps<"/platform/gyms/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_gym", { p_gym_id: id });
  if (error?.message === "Gym not found") notFound();
  if (error) throw error;
  const { gym, team, counts, months } = data as unknown as GymDetail;
  const { data: activity, error: activityError } = await supabase.rpc("audit_entries", { p_gym_id: id, p_limit: 30 });
  if (activityError) throw activityError;

  const money = (paise: number) => formatMoney(Number(paise), gym.currency);
  const stats: [string, number][] = [
    ["Members", counts.members],
    ["Waiting to join", counts.pending_joins],
    ["UPI to confirm", counts.pending_upi],
    ["Check-ins 30d", counts.checkins_30d],
    ["Classes 30d", counts.classes_30d],
    ["Workouts 30d", counts.workouts_30d],
  ];

  return (
    <>
      <Link href="/platform" className="text-sm text-muted hover:text-foreground">
        ← Gyms
      </Link>
      <div className="mt-2 mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">{gym.name}</h1>
          <p className="text-sm text-muted">
            <span className="font-mono">{gym.slug}</span> · {gym.platform_plan} · joined {date(gym.created_at)}
            {gym.phone ? ` · ${gym.phone}` : ""}
          </p>
          {gym.address && <p className="text-sm text-muted">{gym.address}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {gym.deleted_at ? <Badge tone="bad">Deleted {date(gym.deleted_at)}</Badge> : gym.status !== "active" && <Badge tone="bad">Suspended</Badge>}
            {Object.entries(gym.sections).map(([k, on]) => (
              <Badge key={k} tone={on ? "good" : "neutral"}>
                {SECTION_LABELS[k] ?? k} {on ? "on" : "off"}
              </Badge>
            ))}
          </div>
        </div>
        <StatusActions gymId={gym.id} status={gym.status} deleted={!!gym.deleted_at} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map(([k, v]) => (
          <Card key={k}>
            <p className="text-xs text-muted">{k}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{v}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 font-medium">Team</h2>
          <Card className="p-0">
            <ul className="divide-y divide-border">
              {team.map((t) => (
                <li key={t.email} className="p-3 text-sm">
                  <p className="font-medium">
                    {t.name || "No name"} <span className="text-xs font-normal text-muted">{rolesLabel(t.role, t.extra_roles)}</span>
                    {t.status !== "active" && <span className="ml-1 text-xs text-amber-700 dark:text-amber-400">({t.status})</span>}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {t.email}
                    {t.phone ? ` · ${t.phone}` : ""} · last signed in {ago(t.last_sign_in_at)}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <section>
          <h2 className="mb-2 font-medium">Collected by month</h2>
          {months.length === 0 ? (
            <Card className="text-sm text-muted">No payments in the last 6 months.</Card>
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-muted">
                  <tr>
                    <th className="p-3 font-medium">Month</th>
                    <th className="p-3 text-right font-medium">Total</th>
                    <th className="p-3 text-right font-medium">Cash</th>
                    <th className="p-3 text-right font-medium">UPI</th>
                    <th className="p-3 text-right font-medium">Payments</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((m) => (
                    <tr key={m.month} className="border-b border-border last:border-0">
                      <td className="p-3">{m.month}</td>
                      <td className="p-3 text-right tabular-nums">{money(m.paise)}</td>
                      <td className="p-3 text-right tabular-nums">{money(m.cash_paise)}</td>
                      <td className="p-3 text-right tabular-nums">{money(m.upi_paise)}</td>
                      <td className="p-3 text-right tabular-nums">{m.payments}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </section>
      </div>

      <section className="mt-6">
        <h2 className="mb-2 font-medium">Recent activity</h2>
        <ActivityList
          rows={activity as ActivityRow[]}
          basePath={`/platform/gyms/${gym.id}`}
          group={null}
          forOwner={false}
          currency={gym.currency}
          timezone={gym.timezone}
          hasMore={false}
        />
        <Link href={`/platform/activity?gym=${gym.id}`} className="mt-3 inline-block text-sm text-brand hover:underline">
          All of this gym&apos;s activity →
        </Link>
      </section>
    </>
  );
}
