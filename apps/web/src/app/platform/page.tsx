import Link from "next/link";
import { formatMoney } from "@gymos/shared";
import { Badge, Card, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { ago, date, quiet } from "./format";

// Every gym with health numbers: counts and totals only, no member details.
export default async function PlatformGymsPage() {
  const supabase = await createClient();
  const { data: gyms, error } = await supabase.rpc("platform_gyms");
  if (error) throw error;

  const live = gyms.filter((g) => g.status === "active" && !g.deleted_at);
  // Live gyms first (most recently active on top), then suspended and deleted ones.
  gyms.sort((x, y) => {
    const dead = (g: (typeof gyms)[number]) => (g.deleted_at ? 2 : g.status === "active" ? 0 : 1);
    return dead(x) - dead(y) || (y.last_activity ?? "").localeCompare(x.last_activity ?? "");
  });
  const inr = live.filter((g) => g.currency === "INR");
  const tiles = [
    { label: "Active gyms", value: String(live.length), sub: `${gyms.length - live.length} suspended or deleted` },
    {
      label: "Members",
      value: String(live.reduce((n, g) => n + g.members, 0)),
      sub: `${live.reduce((n, g) => n + g.active_memberships, 0)} with an active plan`,
    },
    { label: "Check-ins, 7 days", value: String(live.reduce((n, g) => n + g.checkins_7d, 0)), sub: "all gyms" },
    {
      label: "Collected, 30 days",
      value: formatMoney(inr.reduce((n, g) => n + Number(g.collected_30d_paise), 0)),
      sub: "by INR gyms from their members",
    },
  ];

  return (
    <>
      <PageHeader title="Gyms" />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label}>
            <p className="text-sm text-muted">{t.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{t.value}</p>
            <p className="text-xs text-muted">{t.sub}</p>
          </Card>
        ))}
      </div>

      <ul className="space-y-2">
        {gyms.map((g) => {
          const state = g.deleted_at
            ? { tone: "bad" as const, text: "Deleted" }
            : g.status !== "active"
              ? { tone: "bad" as const, text: "Suspended" }
              : quiet(g.last_activity)
                ? { tone: "warn" as const, text: "Quiet" }
                : { tone: "good" as const, text: "Active" };
          const stats: [string, string | number][] = [
            ["Members", g.members],
            ["Active plans", g.active_memberships],
            ["Team", g.team],
            ["Check-ins 7d", g.checkins_7d],
            ["Collected 30d", formatMoney(Number(g.collected_30d_paise), g.currency)],
            ["Last activity", ago(g.last_activity)],
          ];
          return (
            <li key={g.id}>
              <Link href={`/platform/gyms/${g.id}`} className="block">
                <Card className="transition hover:border-brand">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {g.name} <span className="font-mono text-xs text-muted">{g.slug}</span>
                      </p>
                      <p className="truncate text-xs text-muted">
                        {g.owner_name || "No owner"}
                        {g.owner_email ? ` · ${g.owner_email}` : ""}
                        {g.owner_phone ? ` · ${g.owner_phone}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted">{g.platform_plan}</span>
                      <Badge tone={state.tone}>{state.text}</Badge>
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-sm sm:grid-cols-6">
                    {stats.map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-xs text-muted">{k}</dt>
                        <dd className="tabular-nums">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  {g.pending_joins > 0 && (
                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{g.pending_joins} waiting for approval</p>
                  )}
                  <p className="mt-2 text-xs text-muted">Joined {date(g.created_at)}</p>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
