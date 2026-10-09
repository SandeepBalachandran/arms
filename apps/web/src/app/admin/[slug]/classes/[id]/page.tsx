import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dayKey, formatDay, formatTime, hasStarted } from "@gymos/shared";
import { Badge, Card, PageHeader } from "@/components/ui";
import { requireGym, STAFF_ROLES, TEAM_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cancelSession, markAttendance, removeBooking } from "../actions";

export const metadata: Metadata = { title: "Class" };

const STATUS = {
  booked: { label: "Booked", tone: "neutral" },
  waitlisted: { label: "Waitlist", tone: "warn" },
  attended: { label: "Attended", tone: "good" },
  no_show: { label: "No-show", tone: "bad" },
  cancelled: { label: "Cancelled", tone: "neutral" },
} as const;

export default async function SessionPage({ params }: PageProps<"/admin/[slug]/classes/[id]">) {
  const { slug, id } = await params;
  const { gym, role } = await requireGym(slug, TEAM_ROLES);
  if (!gym.classes_enabled) notFound();
  const isStaff = STAFF_ROLES.includes(role);

  const supabase = await createClient();
  const { data: session } = await supabase
    .from("class_sessions")
    .select("*, class_types(name), trainer:gym_members(profiles(full_name))")
    .eq("id", id)
    .eq("gym_id", gym.id)
    .maybeSingle();
  if (!session) notFound();

  const { data: bookings, error } = await supabase
    .from("class_bookings")
    .select("id, status, waitlisted_at, created_at, member_id, gym_members!inner(profiles!inner(full_name, phone))")
    .eq("session_id", id)
    .neq("status", "cancelled")
    .order("created_at");
  if (error) throw error;

  const roster = bookings.filter((b) => b.status !== "waitlisted");
  const waitlist = bookings
    .filter((b) => b.status === "waitlisted")
    .sort((a, b) => (a.waitlisted_at ?? "").localeCompare(b.waitlisted_at ?? ""));
  const started = hasStarted(session.starts_at);
  const day = dayKey(session.starts_at, gym.timezone);

  return (
    <>
      <Link href={`/admin/${slug}/classes?week=${day}`} className="text-sm text-muted hover:underline">← Classes</Link>
      <PageHeader title={`${session.class_types.name} · ${formatDay(day)} ${formatTime(session.starts_at, gym.timezone)}`} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div><span className="text-muted">Trainer </span>{session.trainer?.profiles.full_name ?? "—"}</div>
            <div><span className="text-muted">Length </span>{session.duration_min} min</div>
            <div><span className="text-muted">Room </span>{session.room ?? "—"}</div>
            <div><span className="text-muted">Booked </span>{roster.length}/{session.capacity}</div>
            {session.status === "cancelled" && <Badge tone="bad">Cancelled{session.cancel_reason ? `: ${session.cancel_reason}` : ""}</Badge>}
          </Card>

          <section>
            <h2 className="mb-2 font-medium">Roster</h2>
            <Card className="p-0">
              <ul className="divide-y divide-border text-sm">
                {roster.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                    <Link href={`/admin/${slug}/members/${b.member_id}`} className="font-medium hover:underline">
                      {b.gym_members.profiles.full_name || "Unnamed member"}
                    </Link>
                    <span className="flex items-center gap-2">
                      <Badge tone={STATUS[b.status].tone}>{STATUS[b.status].label}</Badge>
                      {session.status === "scheduled" && (
                        <>
                          {(["true", "false"] as const).map((attended) => (
                            <form key={attended} action={markAttendance}>
                              <input type="hidden" name="slug" value={slug} />
                              <input type="hidden" name="session_id" value={id} />
                              <input type="hidden" name="booking_id" value={b.id} />
                              <input type="hidden" name="attended" value={attended} />
                              <button className="rounded-lg border border-border px-2 py-1 text-xs">
                                {attended === "true" ? "Came" : "No-show"}
                              </button>
                            </form>
                          ))}
                          {isStaff && !started && b.status === "booked" && (
                            <form action={removeBooking}>
                              <input type="hidden" name="slug" value={slug} />
                              <input type="hidden" name="session_id" value={id} />
                              <input type="hidden" name="booking_id" value={b.id} />
                              <button className="px-1 text-xs text-danger hover:underline">Remove</button>
                            </form>
                          )}
                        </>
                      )}
                    </span>
                  </li>
                ))}
                {roster.length === 0 && <li className="p-6 text-center text-muted">No bookings yet.</li>}
              </ul>
            </Card>
          </section>

          {waitlist.length > 0 && (
            <section>
              <h2 className="mb-2 font-medium">Waitlist</h2>
              <Card className="p-0">
                <ol className="divide-y divide-border text-sm">
                  {waitlist.map((b, i) => (
                    <li key={b.id} className="flex justify-between p-3">
                      <span>{i + 1}. {b.gym_members.profiles.full_name || "Unnamed member"}</span>
                      <span className="text-muted">Moves up automatically if someone cancels</span>
                    </li>
                  ))}
                </ol>
              </Card>
            </section>
          )}
        </div>

        {isStaff && session.status === "scheduled" && !started && (
          <Card className="h-fit">
            <h2 className="mb-1 font-medium">Cancel this class</h2>
            <p className="mb-3 text-sm text-muted">Booked members see it as cancelled in the app.</p>
            <form action={cancelSession} className="space-y-2">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="id" value={id} />
              <input
                name="reason"
                placeholder="Reason (optional)"
                maxLength={300}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              />
              <button className="w-full rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white">Cancel class</button>
            </form>
          </Card>
        )}
      </div>
    </>
  );
}
