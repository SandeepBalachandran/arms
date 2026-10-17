import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { Download, Upload } from "lucide-react";
import { BRAND, membershipState, rolesLabel, todayIn, type Subscription } from "@gymos/shared";
import { ActionForm } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { MembershipBadge } from "@/components/membership-badge";
import { Pagination, pageOf } from "@/components/pagination";
import { Card, PageHeader } from "@/components/ui";
import { requireGym, TEAM_ROLES, type GymRole } from "@/lib/auth";
import { signAvatars } from "@/lib/avatars";
import { createClient } from "@/lib/supabase/server";
import { joinUrl } from "@/lib/site";
import { reviewJoinRequest } from "./actions";
import { AddMember } from "./add-member";
import { RoleSelect } from "./role-select";
import { EditMemberButton } from "./[id]/member-actions";

export const metadata: Metadata = { title: "Members" };

const FILTER_KEYS = ["all", "member", "active", "expiring", "expired", "team"] as const;
type Filter = (typeof FILTER_KEYS)[number];

export default async function MembersPage({ params, searchParams }: PageProps<"/admin/[slug]/members">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { show, q } = sp;
  const filter: Filter = FILTER_KEYS.includes(show as Filter) ? (show as Filter) : "all";
  const query = typeof q === "string" ? q.trim() : "";

  const { gym, role: myRole, user, can } = await requireGym(slug, TEAM_ROLES);
  const canManage = can("manage_members");
  const isOwner = myRole === "owner";
  const assignable: GymRole[] = isOwner ? ["admin", "staff", "trainer", "member"] : ["staff", "trainer", "member"];
  const extraAssignable: GymRole[] = isOwner ? ["admin", "staff", "trainer"] : ["staff", "trainer"];

  const supabase = await createClient();
  // Everyone who matches, 1,000 rows a request (the API's cap); the
  // membership filters need each person's plans, so paging happens after.
  const search = query.replace(/[,()*%\\]/g, " ").trim();
  const membersFrom = (from: number) => {
    let request = supabase
      .from("gym_members")
      .select("id, user_id, role, extra_roles, status, joined_at, profiles!inner(full_name, phone, avatar_url)")
      .eq("gym_id", gym.id)
      .neq("status", "pending")
      .order("joined_at", { ascending: false })
      .order("id")
      .range(from, from + 999);
    if (filter === "team") request = request.neq("role", "member");
    else if (filter !== "all") request = request.eq("role", "member");
    if (search) request = request.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`, { referencedTable: "profiles" });
    return request;
  };
  const members: NonNullable<Awaited<ReturnType<typeof membersFrom>>["data"]> = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await membersFrom(from);
    if (error) throw error;
    members.push(...data);
    if (data.length < 1000) break;
  }

  const { data: pending } = canManage
    ? await supabase
        .from("gym_members")
        .select("id, joined_at, profiles!inner(full_name, phone)")
        .eq("gym_id", gym.id)
        .eq("status", "pending")
        .order("joined_at")
    : { data: [] };

  // Plans in batches of 100 people, so the request URL stays short.
  const ids = members.map((m) => m.id);
  const batches = await Promise.all(
    Array.from({ length: Math.ceil(ids.length / 100) }, (_, i) =>
      supabase
        .from("subscriptions")
        .select("member_id, status, starts_on, ends_on")
        .in("member_id", ids.slice(i * 100, (i + 1) * 100))
        .neq("status", "cancelled"),
    ),
  );
  const subs = batches.flatMap((b) => {
    if (b.error) throw b.error;
    return b.data;
  });

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
  const paged = pageOf(rows, sp.page);
  const photos = await signAvatars(paged.items.map((m) => m.profiles.avatar_url));
  // Only the owner touches admins; the owner may add extra roles to their own row.
  const canEdit = (m: (typeof rows)[number]) => {
    const ownRow = m.user_id === user.id;
    return canManage && (
      m.role === "owner" ? isOwner && ownRow
      : !ownRow && (isOwner || (m.role !== "admin" && !m.extra_roles.includes("admin")))
    );
  };

  return (
    <>
      <PageHeader
        title="Members"
        actions={
          canManage && (
            <div className="flex gap-2">
              <a
                href={`/admin/${slug}/export/members`}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-border/40"
              >
                <Download className="size-4" /> Export
              </a>
              <Link
                href={`/admin/${slug}/members/import`}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-border/40"
              >
                <Upload className="size-4" /> Import
              </Link>
              <AddMember
                slug={slug}
                gymName={gym.name}
                countryCode={gym.phone_country_code}
                whatsappHref={`https://wa.me/?text=${encodeURIComponent(`Join ${gym.name} on ${BRAND.name}: ${joinUrl(slug)}`)}`}
              />
            </div>
          )
        }
      />
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
                    <ActionForm key={approve} action={reviewJoinRequest} success={approve === "true" ? "Member approved" : "Request declined"}>
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
                    </ActionForm>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter members" className="flex flex-wrap gap-1.5">
          {Object.entries({
            all: "Everyone",
            member: "Members",
            active: "Active",
            expiring: "Ending soon",
            expired: "Expired / no plan",
            team: "Team",
          } satisfies Record<Filter, string>).map(([value, label]) => {
            const on = filter === value;
            const qs = new URLSearchParams({ ...(value !== "all" && { show: value }), ...(query && { q: query }) }).toString();
            return (
              <Link
                key={value}
                href={`/admin/${slug}/members${qs ? `?${qs}` : ""}`}
                aria-current={on ? "page" : undefined}
                className={clsx(
                  "rounded-full border px-3 py-1.5 text-sm font-medium",
                  on ? "border-foreground bg-foreground text-background" : "border-border bg-surface hover:bg-border/40",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <form className="w-full sm:w-64">
          {filter !== "all" && <input type="hidden" name="show" value={filter} />}
          <input
            name="q"
            defaultValue={query}
            type="search"
            placeholder="Search name or phone"
            aria-label="Search by name or phone"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          />
        </form>
      </div>

      {/* Phones: a card per person. */}
      <ul className="space-y-2 md:hidden">
        {paged.items.map((m) => (
          <li key={m.id}>
            <Card className="relative flex items-center gap-3 p-3">
              <Avatar name={m.profiles.full_name || "?"} src={photos.get(m.profiles.avatar_url ?? "")} size="md" />
              <div className="min-w-0 flex-1">
                <Link href={`/admin/${slug}/members/${m.id}`} className="block truncate font-medium after:absolute after:inset-0">
                  {m.profiles.full_name || "Unnamed member"}
                </Link>
                <p className="truncate text-sm text-muted">
                  {[m.profiles.phone, m.role !== "member" && rolesLabel(m.role, m.extra_roles)].filter(Boolean).join(" · ") || "No phone"}
                </p>
                {m.role === "member" && (
                  <div className="mt-1.5">
                    <MembershipBadge state={m.membership} warnDays={gym.expiry_warning_days} />
                  </div>
                )}
              </div>
              {canManage && (
                <div className="relative z-10">
                  <EditMemberButton slug={slug} memberId={m.id} fullName={m.profiles.full_name} phone={m.profiles.phone ?? ""} />
                </div>
              )}
            </Card>
          </li>
        ))}
        {rows.length === 0 && <Card className="p-6 text-center text-sm text-muted">No one matches.</Card>}
      </ul>

      <Card className="hidden overflow-x-auto p-0 md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-muted">
            <tr>
              <th className="p-3 font-medium">Name</th>
              <th className="hidden p-3 font-medium sm:table-cell">Phone</th>
              <th className="p-3 font-medium">Membership</th>
              <th className="hidden p-3 font-medium md:table-cell">Role</th>
              <th className="hidden p-3 font-medium lg:table-cell">Joined</th>
              {canManage && <th className="w-12 p-3"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {paged.items.map((m) => {
              const editable = canEdit(m);
              return (
                <tr key={m.id} className="border-b border-border last:border-0">
                  <td className="p-3 font-medium">
                    <Link href={`/admin/${slug}/members/${m.id}`} className="flex items-center gap-2.5 hover:underline">
                      <Avatar name={m.profiles.full_name || "?"} src={photos.get(m.profiles.avatar_url ?? "")} size="xs" />
                      {m.profiles.full_name || "Unnamed member"}
                    </Link>
                  </td>
                  <td className="hidden p-3 text-muted sm:table-cell">{m.profiles.phone ?? "—"}</td>
                  <td className="p-3">
                    {m.role === "member" ? <MembershipBadge state={m.membership} warnDays={gym.expiry_warning_days} /> : <span className="text-muted">—</span>}
                  </td>
                  <td className="hidden p-3 md:table-cell">
                    {editable ? (
                      <RoleSelect
                        slug={slug}
                        memberId={m.id}
                        role={m.role}
                        extraRoles={m.extra_roles}
                        options={assignable}
                        extraOptions={extraAssignable}
                        isOwner={m.role === "owner"}
                        name={m.profiles.full_name || "This member"}
                      />
                    ) : (
                      <span>{rolesLabel(m.role, m.extra_roles)}</span>
                    )}
                  </td>
                  <td className="hidden p-3 text-muted lg:table-cell">{new Date(m.joined_at).toLocaleDateString("en-IN", { timeZone: gym.timezone })}</td>
                  {canManage && (
                    <td className="p-1 text-right">
                      <EditMemberButton
                        slug={slug}
                        memberId={m.id}
                        fullName={m.profiles.full_name}
                        phone={m.profiles.phone ?? ""}
                      />
                    </td>
                  )}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted">No one matches.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
      <Pagination {...paged} shown={paged.items.length} params={sp} noun={rows.length === 1 ? "person" : "people"} />
    </>
  );
}
