import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import {
  addDays,
  formatDate,
  formatDuration,
  formatMoney,
  formatSessions,
  formatSessionsLeft,
  ptRunningLow,
  ptState,
  todayIn,
  type PaymentMethod,
} from "@gymos/shared";
import { EyeOff, HeartHandshake, Users } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, PageHeader } from "@/components/ui";
import { requireGym, STAFF_ROLES, TEAM_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deletePackage, togglePackage } from "./actions";
import { LogSessionDialog, PackageDialog, SellDialog, type PtPackage } from "./forms";

export const metadata: Metadata = { title: "Personal training" };

export default async function PtPage({ params, searchParams }: PageProps<"/admin/[slug]/pt">) {
  const { slug } = await params;
  const { view } = await searchParams;
  const { gym, role, memberId } = await requireGym(slug, TEAM_ROLES);
  if (!gym.pt_enabled) notFound();
  const isStaff = STAFF_ROLES.includes(role);
  const canEditPackages = role === "owner" || role === "admin";
  // Trainers start on their own clients.
  const mineOnly = role === "trainer" ? view !== "all" : view === "mine";

  const today = todayIn(gym.timezone);
  const monthStart = `${today.slice(0, 8)}01`;
  const supabase = await createClient();
  const [packages, subs, team, members, monthSessions, monthRevenue] = await Promise.all([
    supabase.from("pt_packages").select("*").eq("gym_id", gym.id).order("sort_order").order("price_paise"),
    supabase
      .from("pt_subscriptions")
      .select(
        `id, member_id, trainer_member_id, package_id, package_name, sessions_total, starts_on, ends_on, status,
        client:gym_members!pt_subscriptions_member_id_fkey(profiles!inner(full_name)),
        trainer:gym_members!pt_subscriptions_trainer_member_id_fkey(profiles!inner(full_name)),
        pt_sessions(session_on)`,
      )
      .eq("gym_id", gym.id)
      .neq("status", "cancelled")
      .gte("ends_on", addDays(today, -30))
      .order("ends_on"),
    supabase.from("gym_members").select("id, role, profiles!inner(full_name)").eq("gym_id", gym.id).eq("status", "active").neq("role", "member"),
    isStaff
      ? supabase.from("gym_members").select("id, profiles!inner(full_name)").eq("gym_id", gym.id).eq("status", "active")
      : Promise.resolve({ data: [], error: null }),
    supabase.from("pt_sessions").select("id", { count: "exact", head: true }).eq("gym_id", gym.id).gte("session_on", monthStart),
    isStaff
      ? supabase.from("payments").select("amount_paise").eq("gym_id", gym.id).eq("status", "paid").not("pt_subscription_id", "is", null).gte("paid_at", `${monthStart}T00:00:00Z`)
      : Promise.resolve({ data: null, error: null }),
  ]);
  for (const r of [packages, subs, team, members, monthSessions, monthRevenue]) if (r.error) throw r.error;

  const trainers = team.data!.map((t) => ({ id: t.id, name: t.profiles.full_name || "Unnamed" }));
  const memberOptions = (members.data ?? [])
    .map((m) => ({ id: m.id, name: m.profiles.full_name || "Unnamed member" }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const methods = gym.manual_payment_methods as PaymentMethod[];

  const clients = subs.data!
    .filter((s) => !mineOnly || s.trainer_member_id === memberId)
    .map((s) => {
      const days = s.pt_sessions.map((x) => x.session_on).sort();
      const state = ptState(s, days.length, today);
      return { ...s, used: days.length, last: days.at(-1) ?? null, state, low: ptRunningLow(state, gym.pt_expiry_warning_sessions) };
    });
  const current = clients.filter((c) => c.state.kind === "active" || c.state.kind === "upcoming");
  const ended = clients.filter((c) => c.state.kind === "expired" || c.state.kind === "used_up");
  const revenue = monthRevenue.data?.reduce((n, p) => n + p.amount_paise, 0);
  const soldCounts = new Map<string, number>();
  for (const s of subs.data!) if (s.package_id) soldCounts.set(s.package_id, (soldCounts.get(s.package_id) ?? 0) + 1);
  const activePackages = packages.data!.filter((p) => p.is_active);
  const sellProps = { slug, currency: gym.currency, packages: activePackages, trainers, methods };

  return (
    <>
      <PageHeader title="Personal training" actions={isStaff && <SellDialog {...sellProps} members={memberOptions} />} />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Active clients" value={current.length} sub={mineOnly ? "yours" : "in the gym"} />
        <Stat label="Running low" value={current.filter((c) => c.low).length} sub="few sessions or days left" />
        <Stat label="Sessions" value={monthSessions.count ?? 0} sub="this month" />
        {revenue !== undefined ? (
          <Stat label="PT sales" value={formatMoney(revenue, gym.currency)} sub="this month" />
        ) : (
          <Stat label="Ended" value={ended.length} sub="in the last 30 days" />
        )}
      </div>

      <section className="mb-10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">Clients</h2>
          {trainers.some((t) => t.id === memberId) && (
            <div className="flex rounded-lg border border-border p-0.5 text-sm">
              {[
                { key: "mine", label: "My clients", active: mineOnly },
                { key: "all", label: "Everyone", active: !mineOnly },
              ].map((o) => (
                <Link
                  key={o.key}
                  href={`?view=${o.key}`}
                  className={clsx("rounded-md px-3 py-1", o.active ? "bg-brand/15 font-medium" : "text-muted hover:text-foreground")}
                >
                  {o.label}
                </Link>
              ))}
            </div>
          )}
        </div>
        {current.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 py-10 text-center">
            <HeartHandshake className="size-8 text-brand" />
            <p className="font-medium">{mineOnly ? "No PT clients assigned to you" : "No PT clients yet"}</p>
            <p className="max-w-sm text-sm text-muted">
              {packages.data!.length === 0
                ? "Start by creating a package below, e.g. 12 sessions in 2 months, or unlimited PT for a month."
                : "Sell a package from here or from a member’s page. Their trainer then logs each session."}
            </p>
          </Card>
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[42rem] text-sm">
              <thead className="border-b border-border text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Client</th>
                  <th className="px-4 py-2 font-medium">Trainer</th>
                  <th className="px-4 py-2 font-medium">Sessions</th>
                  <th className="px-4 py-2 font-medium">Valid till</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {current.map((c) => {
                  const pct = c.sessions_total ? Math.min(100, Math.round((c.used / c.sessions_total) * 100)) : null;
                  const canLog = c.state.kind === "active" && (isStaff || c.trainer_member_id === memberId);
                  return (
                    <tr key={c.id}>
                      <td className="px-4 py-3">
                        <Link href={`/admin/${slug}/members/${c.member_id}`} className="font-medium hover:underline">
                          {c.client?.profiles.full_name || "Unnamed member"}
                        </Link>
                        <p className="text-xs text-muted">{c.package_name}</p>
                      </td>
                      <td className="px-4 py-3">{c.trainer?.profiles.full_name ?? <span className="text-muted">Not assigned</span>}</td>
                      <td className="px-4 py-3">
                        <p className="tabular-nums">{formatSessionsLeft(c, c.used)}</p>
                        {pct !== null && (
                          <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-border/70">
                            <div className={clsx("h-full rounded-full", c.low ? "bg-amber-500" : "bg-brand")} style={{ width: `${pct}%` }} />
                          </div>
                        )}
                        <p className="mt-1 text-xs text-muted">{c.last ? `Last: ${formatDate(c.last)}` : "No sessions yet"}</p>
                      </td>
                      <td className="px-4 py-3">
                        {c.state.kind === "upcoming" ? (
                          <Badge>Starts {formatDate(c.starts_on)}</Badge>
                        ) : (
                          <Badge tone={c.low ? "warn" : "good"}>
                            {formatDate(c.ends_on)}
                            {c.state.kind === "active" && ` · ${c.state.daysLeft}d`}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canLog && (
                          <LogSessionDialog
                            slug={slug}
                            ptSubscriptionId={c.id}
                            clientName={c.client?.profiles.full_name || "client"}
                            today={today}
                            minDate={c.starts_on}
                            compact
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}

        {ended.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-1 text-sm font-medium">Ended in the last 30 days</h3>
            <p className="mb-2 text-sm text-muted">Good people to offer a renewal.</p>
            <ul className="flex flex-wrap gap-2">
              {ended.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/admin/${slug}/members/${c.member_id}`}
                    className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm hover:border-brand"
                  >
                    {c.client?.profiles.full_name || "Unnamed member"}
                    <span className="text-xs text-muted">
                      {c.state.kind === "used_up" ? "all sessions used" : `ended ${formatDate(c.ends_on)}`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-medium">Packages</h2>
            <p className="text-sm text-muted">What you sell. Changes apply to new sales; clients keep what they bought.</p>
          </div>
          {canEditPackages && <PackageDialog slug={slug} currency={gym.currency} />}
        </div>
        {packages.data!.length === 0 ? (
          <Card className="py-8 text-center text-sm text-muted">No packages yet.</Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {activePackages.map((p) => (
                <PackageCard key={p.id} pkg={p} slug={slug} currency={gym.currency} canEdit={canEditPackages} active={soldCounts.get(p.id) ?? 0} />
              ))}
            </div>
            {packages.data!.some((p) => !p.is_active) && (
              <>
                <h3 className="mb-3 mt-8 flex items-center gap-2 text-sm font-medium text-muted">
                  <EyeOff className="size-4" /> Hidden packages
                </h3>
                <div className="grid gap-4 opacity-70 sm:grid-cols-2 xl:grid-cols-3">
                  {packages.data!.filter((p) => !p.is_active).map((p) => (
                    <PackageCard key={p.id} pkg={p} slug={slug} currency={gym.currency} canEdit={canEditPackages} active={soldCounts.get(p.id) ?? 0} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </section>
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: number | string; sub: string }) {
  return (
    <Card className="py-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted">{sub}</p>
    </Card>
  );
}

function PackageCard({ pkg, slug, currency, canEdit, active }: {
  pkg: PtPackage;
  slug: string;
  currency: string;
  canEdit: boolean;
  active: number;
}) {
  const perSession = pkg.sessions ? formatMoney(Math.round(pkg.price_paise / pkg.sessions), currency) : null;
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg font-semibold">{pkg.name}</h3>
        {!pkg.is_active && <Badge>Hidden</Badge>}
      </div>
      <div>
        <p className="text-3xl font-bold tabular-nums">{formatMoney(pkg.price_paise, currency)}</p>
        <p className="text-sm text-muted">
          {formatSessions(pkg.sessions)} · {pkg.sessions ? "use within" : "for"} {formatDuration(pkg.validity_days)}
          {perSession && ` · ${perSession}/session`}
        </p>
      </div>
      {pkg.description && <p className="text-sm text-muted">{pkg.description}</p>}
      <p className="flex items-center gap-1.5 text-sm text-muted">
        <Users className="size-4" /> {active} recent {active === 1 ? "client" : "clients"}
      </p>
      {canEdit && (
        <div className="mt-auto flex flex-wrap gap-2 border-t border-border pt-3">
          <PackageDialog slug={slug} currency={currency} pkg={pkg} />
          <ActionForm action={togglePackage} success={pkg.is_active ? "Package hidden" : "Package is visible again"}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="id" value={pkg.id} />
            <input type="hidden" name="is_active" value={pkg.is_active ? "false" : "true"} />
            <button className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-border/40">{pkg.is_active ? "Hide" : "Show"}</button>
          </ActionForm>
          <ActionForm action={deletePackage} success="Package deleted" confirm={`Delete ${pkg.name}?`} className="ml-auto">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="id" value={pkg.id} />
            <button className="rounded-lg px-3 py-1.5 text-sm text-danger hover:bg-danger/10">Delete</button>
          </ActionForm>
        </div>
      )}
    </Card>
  );
}
