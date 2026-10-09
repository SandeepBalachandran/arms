import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addDays, dayKey, formatDay, formatTime, todayIn } from "@gymos/shared";
import { Badge, Card, PageHeader } from "@/components/ui";
import { requireGym, STAFF_ROLES, TEAM_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ClassTypeForm, SeriesForm } from "./forms";

export const metadata: Metadata = { title: "Classes" };

// Monday of the week containing a YYYY-MM-DD day.
function mondayOf(ymd: string) {
  const dow = new Date(`${ymd}T00:00:00Z`).getUTCDay();
  return addDays(ymd, dow === 0 ? -6 : 1 - dow);
}

export default async function ClassesPage({ params, searchParams }: PageProps<"/admin/[slug]/classes">) {
  const { slug } = await params;
  const { week } = await searchParams;
  const { gym, role } = await requireGym(slug, TEAM_ROLES);
  if (!gym.classes_enabled) notFound();
  const isStaff = STAFF_ROLES.includes(role);

  const today = todayIn(gym.timezone);
  const monday = mondayOf(typeof week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  const supabase = await createClient();
  const [schedule, types, team] = await Promise.all([
    // A day either side in UTC, then group by the gym's local day.
    supabase.rpc("class_schedule", {
      p_gym_id: gym.id,
      p_from: `${addDays(monday, -1)}T00:00:00Z`,
      p_to: `${addDays(monday, 8)}T00:00:00Z`,
    }),
    supabase.from("class_types").select("id, name, default_capacity, default_duration_min").eq("gym_id", gym.id).eq("is_active", true).order("name"),
    supabase.from("gym_members").select("id, role, profiles!inner(full_name)").eq("gym_id", gym.id).neq("role", "member"),
  ]);
  if (schedule.error) throw schedule.error;
  if (types.error) throw types.error;
  if (team.error) throw team.error;

  const byDay = Map.groupBy(schedule.data, (s) => dayKey(s.starts_at, gym.timezone));

  return (
    <>
      <PageHeader
        title="Classes"
        actions={
          <div className="flex items-center gap-2 text-sm">
            <Link href={`?week=${addDays(monday, -7)}`} className="rounded-lg border border-border px-3 py-1.5">←</Link>
            <span className="min-w-40 text-center font-medium">
              {formatDay(monday)} – {formatDay(addDays(monday, 6))}
            </span>
            <Link href={`?week=${addDays(monday, 7)}`} className="rounded-lg border border-border px-3 py-1.5">→</Link>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {days.map((day) => {
            const sessions = byDay.get(day) ?? [];
            return (
              <section key={day}>
                <h2 className={`mb-2 text-sm font-medium ${day === today ? "text-brand" : "text-muted"}`}>
                  {formatDay(day)}{day === today && " · Today"}
                </h2>
                {sessions.length === 0 ? (
                  <p className="text-sm text-muted">No classes.</p>
                ) : (
                  <div className="space-y-2">
                    {sessions.map((s) => (
                      <Link key={s.id} href={`/admin/${slug}/classes/${s.id}`} className="block">
                        <Card className="flex flex-wrap items-center justify-between gap-2 hover:border-brand">
                          <div>
                            <p className="font-medium">
                              <span className="tabular-nums">{formatTime(s.starts_at, gym.timezone)}</span> · {s.class_name}
                            </p>
                            <p className="text-sm text-muted">
                              {s.duration_min} min{s.trainer_name ? ` · ${s.trainer_name}` : ""}{s.room ? ` · ${s.room}` : ""}
                            </p>
                          </div>
                          {s.status === "cancelled" ? (
                            <Badge tone="bad">Cancelled</Badge>
                          ) : (
                            <span className="flex gap-2">
                              <Badge tone={s.booked_count >= s.capacity ? "warn" : "neutral"}>
                                {s.booked_count}/{s.capacity} booked
                              </Badge>
                              {s.waitlist_count > 0 && <Badge>{s.waitlist_count} waiting</Badge>}
                            </span>
                          )}
                        </Card>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {isStaff && (
          <div className="space-y-6">
            <Card>
              <h2 className="mb-3 font-medium">Schedule classes</h2>
              {types.data.length === 0 ? (
                <p className="text-sm text-muted">Add a class type below first.</p>
              ) : (
                <SeriesForm
                  slug={slug}
                  types={types.data}
                  trainers={team.data.map((t) => ({ id: t.id, name: `${t.profiles.full_name || "Unnamed"} (${t.role})` }))}
                  defaultStart={today}
                />
              )}
            </Card>
            <Card>
              <h2 className="mb-1 font-medium">Class types</h2>
              {types.data.length > 0 && (
                <p className="mb-3 text-sm text-muted">
                  {types.data.map((t) => `${t.name} (${t.default_capacity}, ${t.default_duration_min} min)`).join(" · ")}
                </p>
              )}
              <ClassTypeForm slug={slug} />
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
