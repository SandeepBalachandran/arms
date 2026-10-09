import type { Metadata } from "next";
import { Badge, Card, PageHeader } from "@/components/ui";
import { requireGym, STAFF_ROLES, TEAM_ROLES, type GymRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { updateMember } from "./actions";

export const metadata: Metadata = { title: "Members" };

const ROLE_FILTERS = ["all", "member", "team"] as const;

export default async function MembersPage({ params, searchParams }: PageProps<"/admin/[slug]/members">) {
  const { slug } = await params;
  const { show, q } = await searchParams;
  const filter = ROLE_FILTERS.includes(show as never) ? (show as (typeof ROLE_FILTERS)[number]) : "all";
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
    .order("joined_at", { ascending: false })
    .limit(200);
  if (filter === "member") request = request.eq("role", "member");
  if (filter === "team") request = request.neq("role", "member");
  if (query) request = request.ilike("profiles.full_name", `%${query}%`);
  const { data: rows, error } = await request;
  if (error) throw error;

  return (
    <>
      <PageHeader title="Members" />
      <form className="mb-4 flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search by name"
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        />
        <select name="show" defaultValue={filter} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm">
          <option value="all">Everyone</option>
          <option value="member">Members</option>
          <option value="team">Team</option>
        </select>
        <button className="rounded-lg border border-border px-3 py-2 text-sm">Filter</button>
      </form>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-muted">
            <tr>
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Phone</th>
              <th className="p-3 font-medium">Role</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const editable = canManage && m.role !== "owner" && m.user_id !== user.id &&
                (myRole === "owner" || m.role !== "admin");
              return (
                <tr key={m.id} className="border-b border-border last:border-0">
                  <td className="p-3 font-medium">{m.profiles.full_name || "—"}</td>
                  <td className="p-3 text-muted">{m.profiles.phone ?? "—"}</td>
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
                  <td className="p-3">
                    <Badge tone={m.status === "active" ? "good" : "neutral"}>{m.status}</Badge>
                  </td>
                  <td className="p-3 text-muted">{new Date(m.joined_at).toLocaleDateString("en-IN", { timeZone: gym.timezone })}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted">No one here yet.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </>
  );
}
