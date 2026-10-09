import type { Metadata } from "next";
import Link from "next/link";
import { membershipState, todayIn, type Subscription } from "@gymos/shared";
import { MembershipBadge } from "@/components/membership-badge";
import { Card, PageHeader } from "@/components/ui";
import { requireGym, STAFF_ROLES, TEAM_ROLES, type GymRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { reviewJoinRequest, updateMember } from "./actions";

export const metadata: Metadata = { title: "Members" };

const FILTER_KEYS = ["all", "member", "active", "expiring", "expired", "team"] as const;
type Filter = (typeof FILTER_KEYS)[number];

export default async function MembersPage({ params, searchParams }: PageProps<"/admin/[slug]/members">) {
  const { slug } = await params;
  const { show, q } = await searchParams;
  const filter: Filter = FILTER_KEYS.includes(show as Filter) ? (show as Filter) : "all";
  const query = typeof q === "string" ? q.trim() : "";

  const { gym, role: myRole, user } = await requireGym(slug, TEAM_ROLES);
  const canManage = STAFF_ROLES.includes(myRole);
  const assignable: GymRole[] =
    myRole === "owner" ? ["admin", "staff", "trainer", "member"] : ["staff", "trainer", "member"];

  const supabase = await createClient();
  let request = supabase
    .from("gym_members")
    .select("id, user_id, role, status, joined_at, profiles!inner(full_name, phone)")
    .eq("gym_id", gym.id)
    .neq("status", "pending")
    .order("joined_at", { ascending: false })
    .limit(200);
  if (filter === "team") request = request.neq("role", "member");
  else if (filter !== "all") request = request.eq("role", "member");
  if (query) request = request.ilike("profiles.full_name", `%${query}%`);
  const { data: members, error } = await request;
  if (error) throw error;

  const { data: pending } = canManage
    ? await supabase
        .from("gym_members")
        .select("id, joined_at, profiles!inner(full_name, phone)")
        .eq("gym_id", gym.id)
        .eq("status", "pending")
        .order("joined_at")
    : { data: [] };

  const { data: subs, error: subsError } = members.length
    ? await supabase
        .from("subscriptions")
        .select("member_id, status, starts_on, ends_on")
        .in("member_id", members.map((m) => m.id))
        .neq("status", "cancelled")
    : { data: [], error: null };
  if (subsError) throw subsError;

  const subsByMember = Map.groupBy(subs, (s) => s.member_id);
  const today = todayIn(gym.timezone);
  const rows = members
    .map((m) => ({
      ...m,
      membership: membershipState<Pick<Subscription, "status" | "starts_on" | "ends_on">>(
        subsByMember.get(m.id) ?? [],
        today,
      ),
    }))
    .filter(({ membership: s }) => {
      if (filter === "active") return s.kind === "active" || s.kind === "upcoming";
      if (filter === "expiring") return s.kind === "active" && s.daysLeft <= gym.expiry_warning_days;
      if (filter === "expired") return s.kind === "expired" || s.kind === "none";
      return true;
    });

  return (
    <>
      <PageHeader title="Members" />
      {!!pending?.length && (
        <Card className="mb-6 border-amber-500/50">
          <h2 className="font-medium">Waiting for approval ({pending.length})</h2>
          <ul className="mt-2 divide-y divide-border text-sm">
            {pending.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-medium">{p.profiles.full_name || "Unnamed"}</span>
                  <span className="text-muted"> · {p.profiles.phone ?? "no phone"}</span>
                </span>
                <span className="flex gap-2">
                  {(["true", "false"] as const).map((approve) => (
                    <form key={approve} action={reviewJoinRequest}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="member_id" value={p.id} />
                      <input type="hidden" name="approve" value={approve} />
                      <button
                        className={
                          approve === "true"
                            ? "rounded-lg bg-brand px-3 py-1.5 font-medium text-brand-fg"
                            : "rounded-lg border border-border px-3 py-1.5 text-danger"
                        }
                      >
                        {approve === "true" ? "Approve" : "Decline"}
                      </button>
                    </form>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <form className="mb-4 flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search by name"
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        />
        <select name="show" defaultValue={filter} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm">
          {Object.entries({
            all: "Everyone",
            member: "Members",
            active: "Active membership",
            expiring: `Expiring in ${gym.expiry_warning_days} days`,
            expired: "Expired / no plan",
            team: "Team",
          } satisfies Record<Filter, string>).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <button className="rounded-lg border border-border px-3 py-2 text-sm">Filter</button>
      </form>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-muted">
            <tr>
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Phone</th>
              <th className="p-3 font-medium">Membership</th>
              <th className="p-3 font-medium">Role</th>
              <th className="p-3 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const editable = canManage && m.role !== "owner" && m.user_id !== user.id &&
                (myRole === "owner" || m.role !== "admin");
              return (
                <tr key={m.id} className="border-b border-border last:border-0">
                  <td className="p-3 font-medium">
                    <Link href={`/admin/${slug}/members/${m.id}`} className="hover:underline">
                      {m.profiles.full_name || "Unnamed member"}
                    </Link>
                  </td>
                  <td className="p-3 text-muted">{m.profiles.phone ?? "—"}</td>
                  <td className="p-3">
                    {m.role === "member" ? <MembershipBadge state={m.membership} warnDays={gym.expiry_warning_days} /> : <span className="text-muted">—</span>}
                  </td>
                  <td className="p-3">
                    {editable ? (
                      <form action={updateMember} className="flex gap-1">
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="id" value={m.id} />
                        <select name="role" defaultValue={m.role} className="rounded border border-border bg-surface px-2 py-1 capitalize">
                          {assignable.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <button className="rounded px-2 text-xs text-muted hover:bg-border/40">Save</button>
                      </form>
                    ) : (
                      <span className="capitalize">{m.role}</span>
                    )}
                  </td>
                  <td className="p-3 text-muted">{new Date(m.joined_at).toLocaleDateString("en-IN", { timeZone: gym.timezone })}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted">No one matches.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </>
  );
}
