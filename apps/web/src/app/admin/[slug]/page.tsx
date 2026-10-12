import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  addDays,
  formatDate,
  formatMoney,
  formatReceipt,
  membershipState,
  PAYMENT_METHOD_LABELS,
  renderTemplate,
  todayIn,
  whatsappNumber,
} from "@gymos/shared";
import { CalendarClock, MessageCircle, ReceiptText, ScanLine, Users } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { BarChart } from "@/components/bar-chart";
import { Card } from "@/components/ui";
import { requireGym, STAFF_ROLES, TEAM_ROLES } from "@/lib/auth";
import { signAvatars } from "@/lib/avatars";
import { joinUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { hoursAgo } from "@/lib/time";
import { LiveRefresh } from "./checkin/live-refresh";
import { CopyJoinLink } from "./copy-join-link";
import { reviewJoinRequest } from "./members/actions";

export const metadata: Metadata = { title: "Dashboard" };

const empty = { data: [], error: null };

function Stat({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub: string }) {
  return (
    <Card className="p-3 md:p-4">
      <p className="flex items-center gap-1.5 text-xs text-muted">{icon} {label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums md:text-[26px]">{value}</p>
      <p className="text-xs text-muted">{sub}</p>
    </Card>
  );
}

function greeting(timezone: string) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

// The day's numbers, live visits, and what needs doing now (UPI payments to
// confirm, people waiting to join, memberships ending this week).
export default async function AdminDashboard({ params }: PageProps<"/admin/[slug]">) {
  const { slug } = await params;
  const { gym, role, user } = await requireGym(slug, TEAM_ROLES);
  const isStaff = STAFF_ROLES.includes(role);
  const supabase = await createClient();
  const today = todayIn(gym.timezone);
  const month = today.slice(0, 7);

  const [members, liveSubs, payments, pendingUpi, checkins, joinRequests] = await Promise.all([
    supabase.from("gym_members").select("id", { count: "exact", head: true })
      .eq("gym_id", gym.id).eq("role", "member").eq("status", "active"),
    supabase.from("subscriptions")
      .select("member_id, plan_name, status, starts_on, ends_on, gym_members!inner(profiles!inner(full_name, phone, avatar_url))")
      .eq("gym_id", gym.id).eq("status", "active").gte("ends_on", today),
    isStaff
      ? supabase.from("payments")
          .select("id, amount_paise, paid_at, method, receipt_no, gym_members!inner(id, profiles!inner(full_name, avatar_url)), plans(name), pt_subscriptions(package_name)")
          .eq("gym_id", gym.id).eq("status", "paid").gte("paid_at", addDays(`${month}-01`, -1))
          .order("paid_at", { ascending: false })
      : empty,
    isStaff
      ? supabase.from("payments")
          .select("id, amount_paise, utr, created_at, gym_members!inner(profiles!inner(full_name, avatar_url))")
          .eq("gym_id", gym.id).eq("status", "created").order("created_at")
      : empty,
    gym.checkin_enabled
      ? supabase.from("checkins").select("checked_in_at").eq("gym_id", gym.id)
          .gte("checked_in_at", hoursAgo(15 * 24)).limit(20000)
      : empty,
    isStaff
      ? supabase.from("gym_members").select("id, profiles!inner(full_name, phone, avatar_url)").eq("gym_id", gym.id).eq("status", "pending")
      : empty,
  ]);
  for (const r of [liveSubs, payments, pendingUpi, checkins, joinRequests]) if (r.error) throw r.error;

  const byMember = Map.groupBy(liveSubs.data!, (s) => s.member_id);
  const states = [...byMember].map(([memberId, subs]) => ({
    memberId,
    profile: subs[0].gym_members.profiles,
    state: membershipState(subs, today),
  }));
  const active = states.filter((m) => m.state.kind === "active");
  const expiring = active
    .flatMap((m) => (m.state.kind === "active" && !m.state.next && m.state.daysLeft <= gym.expiry_warning_days
      ? [{ ...m, daysLeft: m.state.daysLeft, endsOn: m.state.current.ends_on, plan: m.state.current.plan_name }]
      : []))
    .sort((a, b) => a.daysLeft - b.daysLeft);
  const paidThisMonth = payments.data!.filter((p) => todayIn(gym.timezone, new Date(p.paid_at!)).startsWith(month));
  const revenue = paidThisMonth.reduce((sum, p) => sum + p.amount_paise, 0);

  // Visits per day for the last 14 days, in the gym's time zone.
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const perDay = Map.groupBy(checkins.data!, (c) => todayIn(gym.timezone, new Date(c.checked_in_at)));
  const visits = days.map((d) => perDay.get(d)?.length ?? 0);
  const visitsToday = visits[visits.length - 1];

  const photos = await signAvatars([
    ...pendingUpi.data!.map((p) => p.gym_members.profiles.avatar_url),
    ...joinRequests.data!.map((m) => m.profiles.avatar_url),
    ...expiring.map((m) => m.profile.avatar_url),
    ...payments.data!.slice(0, 5).map((p) => p.gym_members.profiles.avatar_url),
  ]);
  const photo = (path: string | null) => (path ? photos.get(path) : null);
  const nothingToDo = !pendingUpi.data!.length && !joinRequests.data!.length && !expiring.length;
  const firstName = user.fullName.split(" ")[0];

  return (
    <>
      {gym.checkin_enabled && <LiveRefresh gymId={gym.id} />}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{greeting(gym.timezone)}{firstName ? `, ${firstName}` : ""}</h1>
          <p className="text-sm text-muted">{gym.name} · {formatDate(today)}</p>
        </div>
        {isStaff && (
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`💪 ${gym.name} is on the GOS app! Book classes, check in with your phone, pay by UPI and track workouts.\n\nJoin here 👉 ${joinUrl(slug)}`)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-[#25d366] px-4 py-2 text-sm font-semibold text-[#073b1c] hover:brightness-95"
          >
            <MessageCircle className="size-4" /> Share join link on WhatsApp
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <Stat icon={<Users className="size-3.5" />} label="Active members" value={String(active.length)} sub={`${members.count ?? 0} members in total`} />
        {gym.checkin_enabled && (
          <Stat icon={<ScanLine className="size-3.5" />} label="Visits today" value={String(visitsToday)} sub="Live, as members check in" />
        )}
        {isStaff && (
          <Stat
            icon={<ReceiptText className="size-3.5" />}
            label="Collected this month"
            value={formatMoney(revenue, gym.currency)}
            sub={`${paidThisMonth.length} ${paidThisMonth.length === 1 ? "payment" : "payments"}`}
          />
        )}
        <Stat
          icon={<CalendarClock className="size-3.5" />}
          label={`Ending in ${gym.expiry_warning_days} days`}
          value={String(expiring.length)}
          sub="Send a WhatsApp reminder"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {gym.checkin_enabled ? (
          <Card>
            <h2 className="font-medium">Visits, last 14 days</h2>
            <p className="mb-4 text-sm text-muted">Today updates live as members check in from the app or the poster.</p>
            <BarChart
              values={visits}
              labels={days.map((d) => String(Number(d.slice(8))))}
              format={(v) => `${v} ${v === 1 ? "visit" : "visits"}`}
              label={`Visits per day for the last 14 days. Today: ${visitsToday}.`}
            />
          </Card>
        ) : (
          <Card>
            <h2 className="font-medium">Invite members</h2>
            <p className="mt-1 text-sm text-muted">
              Share this link in your WhatsApp group. Members can also type the gym code{" "}
              <span className="font-mono font-medium text-foreground">{slug}</span> in the app.
            </p>
            <CopyJoinLink path={`/join/${slug}`} />
          </Card>
        )}

        <Card>
          <h2 className="font-medium">Needs attention</h2>
          <ul className="mt-1 divide-y divide-border text-sm">
            {pendingUpi.data!.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <Avatar name={p.gym_members.profiles.full_name} src={photo(p.gym_members.profiles.avatar_url)} />
                <div className="min-w-0 flex-1">
                  <p><span className="font-medium">{p.gym_members.profiles.full_name}</span> <span className="text-muted">paid {formatMoney(p.amount_paise, gym.currency)} by UPI</span></p>
                  <p className="text-xs text-muted">UTR {p.utr ?? "—"}</p>
                </div>
                <Link href={`/admin/${slug}/payments`} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-fg">Review</Link>
              </li>
            ))}
            {joinRequests.data!.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2.5">
                <Avatar name={m.profiles.full_name} src={photo(m.profiles.avatar_url)} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{m.profiles.full_name || "Unnamed"}</p>
                  <p className="text-xs text-muted">Wants to join · {m.profiles.phone ?? "no phone"}</p>
                </div>
                <ActionForm action={reviewJoinRequest} success="Member approved">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="member_id" value={m.id} />
                  <input type="hidden" name="approve" value="true" />
                  <button className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-fg">Approve</button>
                </ActionForm>
              </li>
            ))}
            {expiring.map((m) => {
              const wa = whatsappNumber(m.profile.phone, gym.phone_country_code);
              const message = renderTemplate(gym.renewal_message, {
                name: m.profile.full_name.split(" ")[0] || "there",
                gym: gym.name,
                date: formatDate(m.endsOn),
                plan: m.plan,
              });
              return (
                <li key={m.memberId} className="flex items-center gap-3 py-2.5">
                  <Avatar name={m.profile.full_name} src={photo(m.profile.avatar_url)} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/${slug}/members/${m.memberId}`} className="font-medium hover:underline">
                      {m.profile.full_name || "Unnamed member"}
                    </Link>
                    <p>
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                        {m.daysLeft <= 1 ? "Ends today" : m.daysLeft === 2 ? "Ends tomorrow" : `Ends in ${m.daysLeft - 1} days`}
                      </span>
                    </p>
                  </div>
                  {wa && (
                    <a
                      href={`https://wa.me/${wa}?text=${encodeURIComponent(message)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#25d366] px-3 py-1.5 text-xs font-semibold text-[#073b1c]"
                    >
                      <MessageCircle className="size-3.5" /> Remind
                    </a>
                  )}
                </li>
              );
            })}
            {nothingToDo && <li className="py-6 text-center text-muted">All clear 🎉</li>}
          </ul>
        </Card>
      </div>

      {isStaff && (
        <Card className="mt-4">
          <h2 className="font-medium">Recent payments</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr><th className="py-2 pr-3 font-medium">Date</th><th className="py-2 pr-3 font-medium">Member</th><th className="py-2 pr-3 font-medium">For</th><th className="py-2 pr-3 font-medium">Method</th><th className="py-2 pr-3 text-right font-medium">Amount</th><th className="py-2 font-medium">Receipt</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.data!.slice(0, 5).map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 pr-3 whitespace-nowrap text-muted">{formatDate(todayIn(gym.timezone, new Date(p.paid_at!)))}</td>
                    <td className="py-2 pr-3">
                      <Link href={`/admin/${slug}/members/${p.gym_members.id}`} className="flex items-center gap-2 font-medium hover:underline">
                        <Avatar name={p.gym_members.profiles.full_name} src={photo(p.gym_members.profiles.avatar_url)} size="xs" />
                        {p.gym_members.profiles.full_name}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">{p.pt_subscriptions?.package_name ?? p.plans?.name ?? "—"}</td>
                    <td className="py-2 pr-3">{PAYMENT_METHOD_LABELS[p.method]}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(p.amount_paise, gym.currency)}</td>
                    <td className="py-2"><Link href={`/admin/${slug}/payments/${p.id}`} className="text-brand hover:underline">{formatReceipt(gym.receipt_prefix, p.receipt_no)}</Link></td>
                  </tr>
                ))}
                {payments.data!.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted">No payments this month yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
