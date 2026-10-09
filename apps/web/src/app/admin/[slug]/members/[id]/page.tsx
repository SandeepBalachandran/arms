import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  daysBetween,
  formatDate,
  formatMoney,
  formatReceipt,
  membershipState,
  num,
  PAYMENT_METHOD_LABELS,
  renderTemplate,
  todayIn,
  whatsappNumber,
} from "@gymos/shared";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { MembershipBadge } from "@/components/membership-badge";
import { Badge, Card } from "@/components/ui";
import { requireGym, STAFF_ROLES, TEAM_ROLES } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hoursAgo } from "@/lib/time";
import { CheckInButton } from "../../checkin/check-in-button";
import { addNote, cancelSubscription, deleteNote } from "../actions";
import { HistoryTabs } from "./history-tabs";
import { MemberMenu, RecordPaymentButton } from "./member-actions";

export const metadata: Metadata = { title: "Member" };

const empty = { data: [], error: null };

// Throws a query's error, otherwise returns its rows.
function must<T>(result: { data: T | null; error: unknown }): T {
  if (result.error) throw result.error;
  return result.data as T;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase();
}

function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </Card>
  );
}

function EmptyRow({ cols, text }: { cols: number; text: string }) {
  return (
    <tr>
      <td colSpan={cols} className="p-6 text-center text-muted">{text}</td>
    </tr>
  );
}

export default async function MemberPage({ params, searchParams }: PageProps<"/admin/[slug]/members/[id]">) {
  const { slug, id } = await params;
  const { added } = await searchParams;
  const { gym, role, user } = await requireGym(slug, TEAM_ROLES);
  const isStaff = STAFF_ROLES.includes(role);
  const supabase = await createClient();

  const { data: member } = await supabase
    .from("gym_members")
    .select("id, user_id, role, status, joined_at, profiles!inner(full_name, phone)")
    .eq("id", id)
    .eq("gym_id", gym.id)
    .maybeSingle();
  if (!member) notFound();

  const [subsRes, paymentsRes, plansRes, visitsRes, bookingsRes, notesRes, authUser] = await Promise.all([
    supabase.from("subscriptions").select("*").eq("member_id", id).order("starts_on", { ascending: false }),
    isStaff ? supabase.from("payments").select("*").eq("member_id", id).order("created_at", { ascending: false }) : empty,
    isStaff
      ? supabase.from("plans").select("*").eq("gym_id", gym.id).eq("is_active", true).order("sort_order").order("price_paise")
      : empty,
    gym.checkin_enabled
      ? supabase.from("checkins").select("id, checked_in_at, method, membership_ok").eq("member_id", id)
          .gte("checked_in_at", hoursAgo(90 * 24)).order("checked_in_at", { ascending: false })
      : empty,
    gym.classes_enabled
      ? supabase.from("class_bookings")
          .select("id, status, class_sessions!inner(id, starts_at, class_types(name))")
          .eq("member_id", id).neq("status", "cancelled")
          .order("created_at", { ascending: false }).limit(30)
      : empty,
    supabase.from("member_notes").select("id, body, created_at, author_id, profiles(full_name)")
      .eq("member_id", id).order("created_at", { ascending: false }),
    isStaff ? createAdminClient().auth.admin.getUserById(member.user_id) : Promise.resolve(null),
  ]);
  const subs = { data: must(subsRes) };
  const payments = { data: must(paymentsRes) };
  const plans = { data: must(plansRes) };
  const visits = { data: must(visitsRes) };
  const bookings = { data: must(bookingsRes) };
  const notes = { data: must(notesRes) };

  const progress = gym.workouts_enabled
    ? await Promise.all([
        supabase.from("plan_assignments").select("id, workout_plans!inner(id, name)").eq("member_id", id),
        supabase.from("workout_logs").select("id", { count: "exact", head: true })
          .eq("member_id", id).gte("performed_at", hoursAgo(30 * 24)),
        supabase.from("body_metrics").select("measured_on, weight_kg").eq("member_id", id)
          .not("weight_kg", "is", null).order("measured_on", { ascending: false }).limit(1).maybeSingle(),
      ])
    : null;

  const today = todayIn(gym.timezone);
  const state = membershipState(subs.data, today);
  const name = member.profiles.full_name || "Unnamed member";
  const phone = member.profiles.phone;
  const email = authUser?.data.user?.email ?? null;
  const active = member.status === "active";
  const dateTime = (iso: string) =>
    new Date(iso).toLocaleString("en-IN", { timeZone: gym.timezone, dateStyle: "medium", timeStyle: "short" });

  const totalPaid = payments.data.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount_paise, 0);
  const visitsThisMonth = visits.data.filter((v) => todayIn(gym.timezone, new Date(v.checked_in_at)).startsWith(today.slice(0, 7))).length;
  const attended = bookings.data.filter((b) => b.status === "attended").length;

  // WhatsApp: the renewal reminder when expiring/expired, else a plain hello.
  const wa = whatsappNumber(phone, gym.phone_country_code);
  const reminderDate = state.kind === "active" ? state.next?.ends_on ?? state.current.ends_on : state.kind === "expired" ? state.last.ends_on : null;
  const remind = (state.kind === "active" && state.daysLeft <= gym.expiry_warning_days) || state.kind === "expired";
  const waText = remind && reminderDate
    ? renderTemplate(gym.renewal_message, {
        name: name.split(" ")[0],
        gym: gym.name,
        date: formatDate(reminderDate),
        plan: state.kind === "active" ? state.current.plan_name : state.kind === "expired" ? state.last.plan_name : "",
      })
    : `Hi ${name.split(" ")[0]}, `;

  const paymentProps = {
    slug,
    memberId: id,
    plans: plans.data,
    currency: gym.currency,
    methods: gym.manual_payment_methods.filter((m) => m !== "online"),
  };
  const nextStartHint =
    state.kind === "active" ? `starts after the current one ends (${formatDate(addDay(state.next?.ends_on ?? state.current.ends_on))})` : "starts today";

  return (
    <>
      <Link href={`/admin/${slug}/members`} className="text-sm text-muted hover:underline">← Members</Link>

      {added && (
        <div className="mt-4 rounded-xl border border-green-500/50 bg-green-500/10 p-4 text-sm">
          Member added. Record their first payment to start their membership.
        </div>
      )}
      {!active && (
        <div className="mt-4 rounded-xl border border-border bg-border/30 p-4 text-sm">
          {member.status === "pending" ? "Waiting for approval on the Members page." : "Removed from the gym. They can't use the app here until restored (⋯ menu)."}
        </div>
      )}

      {/* Profile header */}
      <Card className="mt-4 flex flex-wrap items-center gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-brand text-xl font-bold text-brand-fg">
          {initials(name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{name}</h1>
            {member.role === "member" ? (
              <MembershipBadge state={state} warnDays={gym.expiry_warning_days} />
            ) : (
              <Badge>{member.role}</Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            {phone && (
              <a href={`tel:${phone}`} className="flex items-center gap-1 hover:text-foreground">
                <Phone className="size-3.5" /> {phone}
              </a>
            )}
            {email && !email.endsWith("@gymos.test") && (
              <a href={`mailto:${email}`} className="flex items-center gap-1 hover:text-foreground">
                <Mail className="size-3.5" /> {email}
              </a>
            )}
            <span>Member since {formatDate(todayIn(gym.timezone, new Date(member.joined_at)))}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {wa && (
            <a
              href={`https://wa.me/${wa}?text=${encodeURIComponent(waText)}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-border/40"
            >
              <MessageCircle className="size-4" /> {remind ? "Send reminder" : "WhatsApp"}
            </a>
          )}
          {isStaff && gym.checkin_enabled && active && <CheckInButton slug={slug} memberId={id} />}
          {isStaff && active && (
            <RecordPaymentButton label="Record payment" hint={`For payments at the front desk. The new membership ${nextStartHint}.`} {...paymentProps} />
          )}
          {isStaff && (
            <MemberMenu
              slug={slug}
              memberId={id}
              fullName={member.profiles.full_name}
              phone={phone ?? ""}
              active={member.status !== "inactive"}
              canRemove={member.role !== "owner" && member.user_id !== user.id && member.status !== "pending"}
            />
          )}
        </div>
      </Card>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Membership"
          value={
            state.kind === "active" ? `${state.daysLeft} days left`
            : state.kind === "upcoming" ? `Starts in ${state.startsIn}d`
            : state.kind === "expired" ? "Expired"
            : "No plan"
          }
          sub={
            state.kind === "active" ? `till ${formatDate(state.next?.ends_on ?? state.current.ends_on)}`
            : state.kind === "expired" ? `${state.daysAgo} days ago`
            : undefined
          }
        />
        {isStaff && <Stat label="Total paid" value={formatMoney(totalPaid, gym.currency)} sub={`${payments.data.filter((p) => p.status === "paid").length} payments`} />}
        {gym.checkin_enabled && (
          <Stat
            label="Visits this month"
            value={visitsThisMonth}
            sub={visits.data[0] ? `last ${formatDate(todayIn(gym.timezone, new Date(visits.data[0].checked_in_at)))}` : "no visits yet"}
          />
        )}
        {gym.classes_enabled && <Stat label="Classes attended" value={attended} sub={`${bookings.data.length} booked`} />}
        {progress && <Stat label="Workouts (30 days)" value={progress[1].count ?? 0} sub={progress[2].data ? `${num(progress[2].data.weight_kg)} kg` : undefined} />}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* Current membership */}
          {member.role === "member" && (
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-medium">Current membership</h2>
                  {state.kind === "active" && (
                    <p className="text-sm text-muted">
                      {state.current.plan_name} · {formatDate(state.current.starts_on)} – {formatDate(state.current.ends_on)}
                    </p>
                  )}
                  {state.kind === "upcoming" && <p className="text-sm text-muted">{state.next.plan_name} starts {formatDate(state.next.starts_on)}</p>}
                  {state.kind === "expired" && <p className="text-sm text-danger">{state.last.plan_name} ended {formatDate(state.last.ends_on)}</p>}
                  {state.kind === "none" && <p className="text-sm text-muted">No membership yet.</p>}
                </div>
                {isStaff && active && plans.data.length > 0 && (
                  <RecordPaymentButton
                    label={state.kind === "none" ? "Start membership" : "Renew"}
                    variant="secondary"
                    hint={`The new membership ${nextStartHint}.`}
                    {...paymentProps}
                  />
                )}
              </div>
              {state.kind === "active" && <PeriodBar start={state.current.starts_on} end={state.current.ends_on} today={today} warn={state.daysLeft <= gym.expiry_warning_days} />}
              {state.kind === "active" && state.next && (
                <p className="mt-3 text-sm text-muted">Renewed: {state.next.plan_name} from {formatDate(state.next.starts_on)}</p>
              )}
              {isStaff && plans.data.length === 0 && (
                <p className="mt-2 text-sm text-muted">
                  Create a plan on the <Link href={`/admin/${slug}/plans`} className="text-brand hover:underline">Plans</Link> page to record payments.
                </p>
              )}
            </Card>
          )}

          {/* History */}
          <Card>
            <HistoryTabs
              tabs={[
                {
                  id: "subscriptions",
                  label: "Subscriptions",
                  count: subs.data.length,
                  content: (
                    <table className="w-full text-sm">
                      <tbody>
                        {subs.data.map((s) => {
                          const expired = s.status === "expired" || (s.status === "active" && s.ends_on < today);
                          return (
                            <tr key={s.id} className="border-b border-border last:border-0">
                              <td className="py-2 pr-3">
                                <p className="font-medium">{s.plan_name}</p>
                                <p className="text-xs text-muted">{formatDate(s.starts_on)} – {formatDate(s.ends_on)} · {formatMoney(s.price_paise, gym.currency)}</p>
                              </td>
                              <td className="py-2 text-right">
                                {s.status === "cancelled" ? <Badge tone="bad">Cancelled</Badge>
                                  : expired ? <Badge>Expired</Badge>
                                  : s.starts_on > today ? <Badge>Upcoming</Badge>
                                  : <Badge tone="good">Active</Badge>}
                              </td>
                              <td className="w-16 py-2 text-right">
                                {isStaff && s.status === "active" && !expired && (
                                  <form action={cancelSubscription}>
                                    <input type="hidden" name="slug" value={slug} />
                                    <input type="hidden" name="member_id" value={id} />
                                    <input type="hidden" name="id" value={s.id} />
                                    <button className="text-xs text-danger hover:underline">Cancel</button>
                                  </form>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {subs.data.length === 0 && <EmptyRow cols={3} text="No subscriptions yet." />}
                      </tbody>
                    </table>
                  ),
                },
                ...(isStaff
                  ? [{
                      id: "payments",
                      label: "Payments",
                      count: payments.data.length,
                      content: (
                        <table className="w-full text-sm">
                          <tbody>
                            {payments.data.map((p) => (
                              <tr key={p.id} className="border-b border-border last:border-0">
                                <td className="py-2 pr-3">
                                  <p className="font-medium tabular-nums">{formatMoney(p.amount_paise, gym.currency)}</p>
                                  <p className="text-xs text-muted">
                                    {dateTime(p.paid_at ?? p.created_at)} · {PAYMENT_METHOD_LABELS[p.method]}
                                    {p.utr && ` · ref ${p.utr}`}{p.note && ` · ${p.note}`}
                                  </p>
                                </td>
                                <td className="py-2 text-right font-mono text-xs">
                                  {p.status === "paid" ? formatReceipt(gym.receipt_prefix, p.receipt_no)
                                    : p.status === "created" ? <Badge tone="warn">Waiting</Badge>
                                    : <Badge tone="bad">{p.status === "failed" ? "Rejected" : p.status}</Badge>}
                                </td>
                              </tr>
                            ))}
                            {payments.data.length === 0 && <EmptyRow cols={2} text="No payments yet." />}
                          </tbody>
                        </table>
                      ),
                    }]
                  : []),
                ...(gym.checkin_enabled
                  ? [{
                      id: "visits",
                      label: "Visits",
                      count: visits.data.length,
                      content: (
                        <ul className="divide-y divide-border text-sm">
                          {visits.data.slice(0, 30).map((v) => (
                            <li key={v.id} className="flex justify-between py-2">
                              <span>{dateTime(v.checked_in_at)}</span>
                              <span className="flex gap-2">
                                {!v.membership_ok && <Badge tone="warn">No active plan</Badge>}
                                <Badge>{v.method === "self" ? "App" : v.method === "scan" ? "Scan" : "Desk"}</Badge>
                              </span>
                            </li>
                          ))}
                          {visits.data.length === 0 && <li className="py-6 text-center text-muted">No visits in the last 90 days.</li>}
                        </ul>
                      ),
                    }]
                  : []),
                ...(gym.classes_enabled
                  ? [{
                      id: "classes",
                      label: "Classes",
                      count: bookings.data.length,
                      content: (
                        <ul className="divide-y divide-border text-sm">
                          {bookings.data.map((b) => (
                            <li key={b.id} className="flex justify-between py-2">
                              <Link href={`/admin/${slug}/classes/${b.class_sessions.id}`} className="hover:underline">
                                {b.class_sessions.class_types.name} · {dateTime(b.class_sessions.starts_at)}
                              </Link>
                              <Badge tone={b.status === "attended" ? "good" : b.status === "no_show" ? "bad" : "neutral"}>
                                {b.status === "no_show" ? "No-show" : b.status}
                              </Badge>
                            </li>
                          ))}
                          {bookings.data.length === 0 && <li className="py-6 text-center text-muted">No class bookings.</li>}
                        </ul>
                      ),
                    }]
                  : []),
              ]}
            />
          </Card>
        </div>

        <div className="space-y-6">
          {/* Notes */}
          <Card>
            <h2 className="font-medium">Notes</h2>
            <p className="mb-3 text-xs text-muted">Only your team sees these.</p>
            <form action={addNote} className="space-y-2">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="member_id" value={id} />
              <textarea
                name="body"
                required
                maxLength={1000}
                rows={2}
                placeholder="e.g. Knee injury — avoid deep squats"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
              />
              <button className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-border/40">Add note</button>
            </form>
            <ul className="mt-3 space-y-3">
              {notes.data.map((n) => (
                <li key={n.id} className="rounded-lg bg-border/30 p-3 text-sm">
                  <p className="whitespace-pre-wrap">{n.body}</p>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted">
                    <span>{n.profiles?.full_name || "Team"} · {dateTime(n.created_at)}</span>
                    {(n.author_id === user.id || isStaff) && (
                      <form action={deleteNote}>
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="member_id" value={id} />
                        <input type="hidden" name="id" value={n.id} />
                        <button className="hover:text-danger">Delete</button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          {progress && (
            <Card className="text-sm">
              <h2 className="font-medium">Workout plans</h2>
              {progress[0].data?.length ? (
                <ul className="mt-2 space-y-1">
                  {progress[0].data.map((a) => (
                    <li key={a.id}>
                      <Link href={`/admin/${slug}/workouts/${a.workout_plans.id}`} className="text-brand hover:underline">
                        {a.workout_plans.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-muted">None assigned. Assign one from a plan&apos;s page.</p>
              )}
              {progress[2].data && (
                <p className="mt-3 text-muted">
                  Latest weight {num(progress[2].data.weight_kg)} kg ({formatDate(progress[2].data.measured_on)})
                </p>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function addDay(ymd: string) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// How far through the current membership period today is.
function PeriodBar({ start, end, today, warn }: { start: string; end: string; today: string; warn: boolean }) {
  const total = daysBetween(start, end) + 1;
  const used = Math.min(total, Math.max(0, daysBetween(start, today) + 1));
  const pct = Math.round((used / total) * 100);
  return (
    <div className="mt-4">
      <div className="h-2 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Membership period used">
        <div className={warn ? "h-full rounded-full bg-amber-500" : "h-full rounded-full bg-brand"} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted">Day {used} of {total}</p>
    </div>
  );
}
