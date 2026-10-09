import Link from "next/link";
import clsx from "clsx";
import { formatDate, formatSessionsLeft, ptRunningLow, ptState, type PaymentMethod } from "@gymos/shared";
import { ActionForm } from "@/components/action-form";
import { Badge, Card } from "@/components/ui";
import type { GymMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cancelPtSubscription, changeTrainer, deleteSession } from "../../pt/actions";
import { LogSessionDialog, SellDialog } from "../../pt/forms";

const STATE_LABEL = { active: "Active", upcoming: "Upcoming", used_up: "All sessions used", expired: "Expired", cancelled: "Cancelled" };

// Personal training on the member page: their packages, sessions used, and
// the trainer. Only rendered when the gym has PT turned on.
export async function PtCard({ gym, slug, memberId, memberName, myMemberId, userId, isStaff, today }: {
  gym: GymMembership["gym"];
  slug: string;
  memberId: string;
  memberName: string;
  myMemberId: string;
  userId: string;
  isStaff: boolean;
  today: string;
}) {
  const supabase = await createClient();
  const [subsRes, packagesRes, teamRes] = await Promise.all([
    supabase
      .from("pt_subscriptions")
      .select(
        `id, package_name, sessions_total, starts_on, ends_on, status, trainer_member_id,
        trainer:gym_members!pt_subscriptions_trainer_member_id_fkey(profiles!inner(full_name)),
        pt_sessions(id, session_on, notes, created_by, created_at)`,
      )
      .eq("member_id", memberId)
      .order("starts_on", { ascending: false }),
    isStaff
      ? supabase.from("pt_packages").select("*").eq("gym_id", gym.id).eq("is_active", true).order("sort_order").order("price_paise")
      : Promise.resolve({ data: [], error: null }),
    supabase.from("gym_members").select("id, profiles!inner(full_name)").eq("gym_id", gym.id).eq("status", "active").neq("role", "member"),
  ]);
  for (const r of [subsRes, packagesRes, teamRes]) if (r.error) throw r.error;

  const trainers = teamRes.data!.map((t) => ({ id: t.id, name: t.profiles.full_name || "Unnamed" }));
  const subs = subsRes.data!.map((s) => {
    const state = ptState(s, s.pt_sessions.length, today);
    return { ...s, state, low: ptRunningLow(state, gym.pt_expiry_warning_sessions) };
  });
  const current = subs.filter((s) => s.state.kind === "active" || s.state.kind === "upcoming");
  const past = subs.filter((s) => !current.includes(s));
  const sessions = subs
    .flatMap((s) => s.pt_sessions.map((x) => ({ ...x, package: s.package_name })))
    .sort((a, b) => b.session_on.localeCompare(a.session_on) || b.created_at.localeCompare(a.created_at));

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">Personal training</h2>
          {current.length === 0 && <p className="text-sm text-muted">No active PT package.</p>}
        </div>
        {isStaff && (
          <SellDialog
            slug={slug}
            currency={gym.currency}
            packages={packagesRes.data!}
            trainers={trainers}
            methods={gym.manual_payment_methods.filter((m) => m !== "online") as PaymentMethod[]}
            member={{ id: memberId, name: memberName }}
            label={current.length ? "Sell another" : "Sell PT package"}
          />
        )}
      </div>
      {isStaff && packagesRes.data!.length === 0 && (
        <p className="mt-2 text-sm text-muted">
          Create a package on the <Link href={`/admin/${slug}/pt`} className="text-brand hover:underline">Personal training</Link> page first.
        </p>
      )}

      {current.map((s) => {
        const used = s.pt_sessions.length;
        const pct = s.sessions_total ? Math.min(100, Math.round((used / s.sessions_total) * 100)) : null;
        const canLog = s.state.kind === "active" && (isStaff || s.trainer_member_id === myMemberId);
        return (
          <div key={s.id} className="mt-4 rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">
                  {s.package_name} {s.state.kind === "upcoming" && <Badge>Starts {formatDate(s.starts_on)}</Badge>}
                  {s.low && <Badge tone="warn">Running low</Badge>}
                </p>
                <p className="text-sm text-muted">
                  {formatDate(s.starts_on)} – {formatDate(s.ends_on)}
                  {s.state.kind === "active" && ` · ${s.state.daysLeft} days left`}
                </p>
              </div>
              {canLog && (
                <LogSessionDialog slug={slug} ptSubscriptionId={s.id} clientName={memberName} today={today} minDate={s.starts_on} />
              )}
            </div>
            <p className="mt-3 text-sm font-medium tabular-nums">{formatSessionsLeft(s, used)}</p>
            {pct !== null && (
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Sessions used">
                <div className={clsx("h-full rounded-full", s.low ? "bg-amber-500" : "bg-brand")} style={{ width: `${pct}%` }} />
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              {isStaff ? (
                <ActionForm action={changeTrainer} success="Trainer updated" className="flex items-center gap-2">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={s.id} />
                  <label htmlFor={`trainer-${s.id}`} className="text-muted">Trainer</label>
                  <select
                    id={`trainer-${s.id}`}
                    name="trainer_member_id"
                    defaultValue={s.trainer_member_id ?? ""}
                    className="rounded-lg border border-border bg-surface px-2 py-1 text-sm"
                  >
                    <option value="">Not assigned</option>
                    {trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <button className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-border/40">Save</button>
                </ActionForm>
              ) : (
                <span className="text-muted">Trainer: {s.trainer?.profiles.full_name ?? "Not assigned"}</span>
              )}
              {isStaff && (
                <ActionForm action={cancelPtSubscription} success="PT package cancelled" confirm={`Cancel ${s.package_name}? Sessions can't be logged on it after this.`}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={s.id} />
                  <button className="text-xs text-danger hover:underline">Cancel package</button>
                </ActionForm>
              )}
            </div>
          </div>
        );
      })}

      {sessions.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-1 text-sm font-medium">Sessions</h3>
          <ul className="divide-y divide-border text-sm">
            {sessions.slice(0, 15).map((x) => (
              <li key={x.id} className="flex items-start justify-between gap-3 py-2">
                <div>
                  <p>{formatDate(x.session_on)} <span className="text-xs text-muted">· {x.package}</span></p>
                  {x.notes && <p className="text-xs text-muted">{x.notes}</p>}
                </div>
                {(isStaff || x.created_by === userId) && (
                  <ActionForm action={deleteSession} success="Session removed" confirm="Remove this session? It goes back on the package.">
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="id" value={x.id} />
                    <button className="text-xs text-muted hover:text-danger">Undo</button>
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {past.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-1 text-sm font-medium">Past packages</h3>
          <ul className="space-y-1 text-sm">
            {past.map((s) => (
              <li key={s.id} className="flex justify-between gap-2">
                <span>{s.package_name} <span className="text-xs text-muted">· {formatDate(s.starts_on)} – {formatDate(s.ends_on)}</span></span>
                <Badge tone={s.state.kind === "cancelled" ? "bad" : "neutral"}>
                  {STATE_LABEL[s.state.kind]} · {s.pt_sessions.length} done
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
