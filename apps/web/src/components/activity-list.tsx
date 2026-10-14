import Link from "next/link";
import { AUDIT_GROUP_LABELS, auditActor, auditGroup, describeAudit, type AuditGroup } from "@gymos/shared";
import { Card } from "@/components/ui";

export type ActivityRow = {
  id: number;
  gym_id: string | null;
  gym_name: string | null;
  actor_name: string;
  actor_platform: boolean;
  action: string;
  details: unknown;
  created_at: string;
};

const GROUP_TONE: Record<AuditGroup, string> = {
  money: "bg-green-500/15 text-green-700 dark:text-green-400",
  people: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  settings: "bg-border/60 text-foreground",
  support: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
};

// The activity log as a list, newest first, with a filter by kind and an
// "Older" link. Used by the owner's Activity page and the platform view.
export function ActivityList({
  rows,
  basePath,
  group,
  forOwner,
  showGym = false,
  currency = "INR",
  timezone = "Asia/Kolkata",
  hasMore,
}: {
  rows: ActivityRow[];
  // The page's own path, for filter and paging links.
  basePath: string;
  group: AuditGroup | null;
  forOwner: boolean;
  showGym?: boolean;
  currency?: string;
  timezone?: string;
  hasMore: boolean;
}) {
  const when = new Intl.DateTimeFormat("en-IN", { timeZone: timezone, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const shown = group ? rows.filter((r) => auditGroup(r.action) === group) : rows;
  // basePath may already carry a query (e.g. ?gym=…); keep it.
  const link = (params: Record<string, string | null>) => {
    const [path, query] = basePath.split("?");
    const q = new URLSearchParams(query);
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    return q.size ? `${path}?${q}` : path;
  };

  return (
    <>
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        {[null, ...(Object.keys(AUDIT_GROUP_LABELS) as AuditGroup[])].map((g) => (
          <Link
            key={g ?? "all"}
            href={link({ group: g })}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${g === group ? "border-brand bg-brand text-brand-fg" : "border-border bg-surface"}`}
          >
            {g ? AUDIT_GROUP_LABELS[g] : "Everything"}
          </Link>
        ))}
      </div>
      {shown.length === 0 ? (
        <Card className="text-sm text-muted">Nothing here yet.</Card>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-border">
            {shown.map((r) => {
              const g = auditGroup(r.action);
              return (
                <li key={r.id} className="flex items-start gap-3 p-3">
                  <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${GROUP_TONE[g]}`}>{AUDIT_GROUP_LABELS[g]}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{describeAudit(r, currency)}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {auditActor(r, forOwner)} · {when.format(new Date(r.created_at))}
                      {showGym && r.gym_name && (
                        <>
                          {" · "}
                          <Link href={`/platform/gyms/${r.gym_id}`} className="hover:underline">{r.gym_name}</Link>
                        </>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      {hasMore && (
        <div className="mt-4">
          <Link href={link({ group, before: String(rows[rows.length - 1].id) })} className="text-sm text-brand hover:underline">
            Older →
          </Link>
        </div>
      )}
    </>
  );
}

export function parseActivityParams(sp: Record<string, string | string[] | undefined>) {
  const group = typeof sp.group === "string" && sp.group in AUDIT_GROUP_LABELS ? (sp.group as AuditGroup) : null;
  const before = typeof sp.before === "string" && /^\d+$/.test(sp.before) ? Number(sp.before) : null;
  return { group, before };
}
