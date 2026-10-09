import type { Metadata } from "next";
import Link from "next/link";
import { addDays, formatDate, formatMoney, membershipState, todayIn } from "@gymos/shared";
import { Card, PageHeader } from "@/components/ui";
import { requireGym, STAFF_ROLES, TEAM_ROLES } from "@/lib/auth";
import { joinUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { hoursAgo } from "@/lib/time";
import { CopyJoinLink } from "./copy-join-link";

export const metadata: Metadata = { title: "Dashboard" };

// wa.me needs the number with country code and no symbols; bare 10-digit
// numbers are assumed to be Indian.
function whatsappNumber(phone: string | null) {
  const digits = phone?.replace(/\D/g, "") ?? "";
  if (digits.length === 10) return `91${digits}`;
  return digits.length >= 11 ? digits : null;
}

export default async function AdminDashboard({ params }: PageProps<"/admin/[slug]">) {
  const { slug } = await params;
  const { gym, role } = await requireGym(slug, TEAM_ROLES);
  const isStaff = STAFF_ROLES.includes(role);
  const supabase = await createClient();
  const today = todayIn(gym.timezone);
  const month = today.slice(0, 7);

  const [members, liveSubs, payments, pending, checkins] = await Promise.all([
    supabase.from("gym_members").select("id", { count: "exact", head: true })
      .eq("gym_id", gym.id).eq("role", "member").eq("status", "active"),
    supabase.from("subscriptions")
      .select("member_id, status, starts_on, ends_on, gym_members!inner(profiles!inner(full_name, phone))")
      .eq("gym_id", gym.id).eq("status", "active").gte("ends_on", today),
    isStaff
      ? supabase.from("payments").select("amount_paise, paid_at")
          .eq("gym_id", gym.id).eq("status", "paid").gte("paid_at", addDays(`${month}-01`, -1))
      : Promise.resolve({ data: [], error: null }),
    isStaff
      ? supabase.from("payments").select("id", { count: "exact", head: true }).eq("gym_id", gym.id).eq("status", "created")
      : Promise.resolve({ count: 0 }),
    gym.checkin_enabled
      ? supabase.from("checkins").select("checked_in_at").eq("gym_id", gym.id)
          .gte("checked_in_at", hoursAgo(36))
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (checkins.error) throw checkins.error;
  if (liveSubs.error) throw liveSubs.error;
  if (payments.error) throw payments.error;

  const byMember = Map.groupBy(liveSubs.data, (s) => s.member_id);
  const states = [...byMember].map(([memberId, subs]) => ({
    memberId,
    profile: subs[0].gym_members.profiles,
    state: membershipState(subs, today),
  }));
  const active = states.filter((m) => m.state.kind === "active");
  const expiring = active
    .flatMap((m) => (m.state.kind === "active" && m.state.daysLeft <= 7 ? [{ ...m, daysLeft: m.state.daysLeft, endsOn: addDays(today, m.state.daysLeft - 1) }] : []))
    .sort((a, b) => a.daysLeft - b.daysLeft);
  const revenue = payments.data
    .filter((p) => todayIn(gym.timezone, new Date(p.paid_at!)).startsWith(month))
    .reduce((sum, p) => sum + p.amount_paise, 0);

  const stats = [
    { label: "Members", value: String(members.count ?? 0) },
    { label: "Active memberships", value: String(active.length) },
    { label: "Expiring in 7 days", value: String(expiring.length) },
    ...(isStaff ? [{ label: "Collected this month", value: formatMoney(revenue, gym.currency) }] : []),
    ...(gym.checkin_enabled
      ? [{
          label: "Checked in today",
          value: String(checkins.data.filter((c) => todayIn(gym.timezone, new Date(c.checked_in_at)) === today).length),
        }]
      : []),
  ];

  return (
    <>
      <PageHeader title="Dashboard" />
      {!!pending.count && (
        <Link
          href={`/admin/${slug}/payments`}
          className="mb-6 block rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 text-sm font-medium"
        >
          {pending.count === 1 ? "1 UPI payment is" : `${pending.count} UPI payments are`} waiting for you to confirm →
        </Link>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <p className="text-sm text-muted">{s.label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-medium">Expiring soon</h2>
          {expiring.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No memberships end in the next 7 days.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border text-sm">
              {expiring.map((m) => {
                const wa = whatsappNumber(m.profile.phone);
                const message = `Hi ${m.profile.full_name.split(" ")[0] || "there"}, your ${gym.name} membership ends on ${formatDate(m.endsOn)}. Renew at the front desk or in the GymOS app.`;
                return (
                  <li key={m.memberId} className="flex items-center justify-between gap-2 py-2">
                    <Link href={`/admin/${slug}/members/${m.memberId}`} className="hover:underline">
                      {m.profile.full_name || "Unnamed member"}
                    </Link>
                    <span className="flex items-center gap-3">
                      <span className="text-muted">{m.daysLeft === 1 ? "Ends today" : `${m.daysLeft} days left`}</span>
                      {wa && (
                        <a
                          href={`https://wa.me/${wa}?text=${encodeURIComponent(message)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-brand hover:underline"
                        >
                          Remind
                        </a>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="font-medium">Invite members</h2>
          <p className="mt-1 text-sm text-muted">
            Share this link in your WhatsApp group. It opens the GymOS app (or offers the install) and joins{" "}
            {gym.name}. Members can also type the gym code <span className="font-mono font-medium text-foreground">{slug}</span> in the app.
          </p>
          <CopyJoinLink path={`/join/${slug}`} />
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Join ${gym.name} on GymOS: ${joinUrl(slug)}`)}`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-sm font-medium text-brand hover:underline"
          >
            Share on WhatsApp
          </a>
        </Card>
      </div>
    </>
  );
}
