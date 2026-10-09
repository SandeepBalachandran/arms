import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { addDays, dayKey, formatDay, formatTime, groupBy, todayIn, type ScheduledClass } from "@gymos/shared";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Dumbbell, Smartphone, Users } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Tooltip } from "@/components/tooltip";
import { Card, PageHeader } from "@/components/ui";
import { requireGym, STAFF_ROLES, TEAM_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { archiveClassType } from "./actions";
import { ClassTypeDialog, ScheduleDialog, type ClassType } from "./forms";

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
  const thisMonday = mondayOf(today);
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
    supabase
      .from("class_types")
      .select("id, name, description, default_capacity, default_duration_min")
      .eq("gym_id", gym.id)
      .eq("is_active", true)
      .order("name"),
    supabase.from("gym_members").select("id, role, profiles!inner(full_name)").eq("gym_id", gym.id).neq("role", "member"),
  ]);
  if (schedule.error) throw schedule.error;
  if (types.error) throw types.error;
  if (team.error) throw team.error;

  const inWeek = schedule.data.filter((s) => days.includes(dayKey(s.starts_at, gym.timezone)));
  const byDay = groupBy(inWeek, (s) => dayKey(s.starts_at, gym.timezone));
  const running = inWeek.filter((s) => s.status !== "cancelled");
  const booked = running.reduce((n, s) => n + s.booked_count, 0);
  const spots = running.reduce((n, s) => n + s.capacity, 0);
  const waiting = running.reduce((n, s) => n + s.waitlist_count, 0);
  const trainers = team.data.map((t) => ({ id: t.id, name: `${t.profiles.full_name || "Unnamed"} (${t.role})` }));

  const scheduleButton = isStaff && types.data.length > 0 && (
    <ScheduleDialog slug={slug} types={types.data} trainers={trainers} defaultStart={monday < today ? today : monday} today={today} />
  );

  if (types.data.length === 0) {
    return (
      <>
        <PageHeader title="Classes" />
        <GettingStarted slug={slug} isStaff={isStaff} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Classes" actions={scheduleButton} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Tooltip content="Previous week">
            <Link href={`?week=${addDays(monday, -7)}`} aria-label="Previous week" className="rounded-lg border border-border p-2 hover:bg-border/40">
              <ChevronLeft className="size-4" />
            </Link>
          </Tooltip>
          <Tooltip content="Next week">
            <Link href={`?week=${addDays(monday, 7)}`} aria-label="Next week" className="rounded-lg border border-border p-2 hover:bg-border/40">
              <ChevronRight className="size-4" />
            </Link>
          </Tooltip>
          <h2 className="ml-2 font-medium">
            {formatDay(monday)} – {formatDay(addDays(monday, 6))}
          </h2>
          {monday !== thisMonday && (
            <Link href="?" className="ml-2 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-border/40">
              This week
            </Link>
          )}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Classes" value={running.length} sub={inWeek.length > running.length ? `${inWeek.length - running.length} cancelled` : "this week"} />
        <Stat label="Bookings" value={booked} sub={spots ? `of ${spots} spots` : "no spots yet"} />
        <Stat label="Full" value={spots ? `${Math.round((booked / spots) * 100)}%` : "—"} sub="of spots taken" />
        <Stat label="Waitlist" value={waiting} sub={waiting ? "waiting for a spot" : "nobody waiting"} />
      </div>

      {inWeek.length === 0 ? (
        <Card className="mb-10 flex flex-col items-center gap-3 py-10 text-center">
          <CalendarDays className="size-8 text-brand" />
          <p className="font-medium">Nothing scheduled this week</p>
          <p className="max-w-sm text-sm text-muted">
            Schedule a class once and it repeats on the days you pick, for as many weeks as you like.
          </p>
          {scheduleButton}
        </Card>
      ) : (
        // Calendar on wide screens; on phones, a list of the days that have classes.
        <div className="mb-10 grid gap-3 lg:grid-cols-7 lg:gap-2">
          {days.map((day) => {
            const sessions = byDay.get(day) ?? [];
            const isToday = day === today;
            return (
              <section key={day} className={clsx("min-w-0", sessions.length === 0 && "max-lg:hidden")}>
                <h3
                  className={clsx(
                    "mb-2 flex items-baseline gap-1.5 text-sm lg:flex-col lg:gap-0 lg:rounded-lg lg:px-2 lg:py-1.5",
                    isToday ? "font-semibold text-brand lg:bg-brand/10" : day < today ? "text-muted" : "",
                  )}
                >
                  <span>{formatDay(day).split(",")[0]}</span>
                  <span className="text-xs text-muted lg:text-sm lg:font-medium lg:text-inherit">
                    {formatDay(day).split(", ")[1]}{isToday && " · Today"}
                  </span>
                </h3>
                <div className="space-y-2">
                  {sessions.map((s) => (
                    <SessionTile key={s.id} session={s} slug={slug} timezone={gym.timezone} past={day < today} />
                  ))}
                  {sessions.length === 0 && <p className="hidden px-2 text-xs text-muted lg:block">—</p>}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-medium">Class types</h2>
            <p className="text-sm text-muted">The classes your gym runs. Spots and length are defaults you can change per schedule.</p>
          </div>
          {isStaff && <ClassTypeDialog slug={slug} />}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {types.data.map((t) => <TypeCard key={t.id} type={t} slug={slug} isStaff={isStaff} />)}
        </div>
      </section>
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: number | string; sub: string }) {
  return (
    <Card className="py-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted">{sub}</p>
    </Card>
  );
}

function SessionTile({ session: s, slug, timezone, past }: { session: ScheduledClass; slug: string; timezone: string; past: boolean }) {
  const cancelled = s.status === "cancelled";
  const full = s.booked_count >= s.capacity;
  const pct = Math.min(100, Math.round((s.booked_count / s.capacity) * 100));
  return (
    <Link
      href={`/admin/${slug}/classes/${s.id}`}
      className={clsx(
        "block rounded-lg border border-border bg-surface p-2.5 text-sm transition hover:border-brand",
        (past || cancelled) && "opacity-60",
      )}
    >
      <p className="flex items-center gap-1 text-xs tabular-nums text-muted">
        <Clock className="size-3" /> {formatTime(s.starts_at, timezone)} · {s.duration_min}m
      </p>
      <p className={clsx("truncate font-medium", cancelled && "line-through")} title={s.class_name}>{s.class_name}</p>
      {(s.trainer_name || s.room) && (
        <p className="truncate text-xs text-muted">{[s.trainer_name, s.room].filter(Boolean).join(" · ")}</p>
      )}
      {cancelled ? (
        <p className="mt-1.5 text-xs font-medium text-danger">Cancelled</p>
      ) : (
        <div className="mt-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-border/70">
            <div className={clsx("h-full rounded-full", full ? "bg-amber-500" : "bg-brand")} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 flex justify-between text-xs tabular-nums text-muted">
            <span>{s.booked_count}/{s.capacity}{full && " · Full"}</span>
            {s.waitlist_count > 0 && <span>+{s.waitlist_count} waiting</span>}
          </p>
        </div>
      )}
    </Link>
  );
}

function TypeCard({ type, slug, isStaff }: { type: ClassType; slug: string; isStaff: boolean }) {
  return (
    <Card className="flex flex-col gap-2">
      <h3 className="font-semibold">{type.name}</h3>
      {type.description && <p className="text-sm text-muted">{type.description}</p>}
      <p className="flex gap-4 text-sm text-muted">
        <span className="flex items-center gap-1"><Users className="size-4" /> {type.default_capacity} spots</span>
        <span className="flex items-center gap-1"><Clock className="size-4" /> {type.default_duration_min} min</span>
      </p>
      {isStaff && (
        <div className="mt-auto flex gap-2 border-t border-border pt-3">
          <ClassTypeDialog slug={slug} type={type} />
          <ActionForm
            action={archiveClassType}
            success={`${type.name} archived`}
            confirm={`Archive ${type.name}? It can't be scheduled again, but classes already on the calendar stay.`}
            className="ml-auto"
          >
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="id" value={type.id} />
            <button className="rounded-lg px-3 py-1.5 text-sm text-danger hover:bg-danger/10">Archive</button>
          </ActionForm>
        </div>
      )}
    </Card>
  );
}

function GettingStarted({ slug, isStaff }: { slug: string; isStaff: boolean }) {
  const steps = [
    { icon: Dumbbell, title: "Add a class type", text: "Zumba, Yoga, HIIT… with how many people fit and how long it runs." },
    { icon: CalendarDays, title: "Put it on the calendar", text: "Pick the days and time once; it repeats for as many weeks as you like." },
    { icon: Smartphone, title: "Members book in the app", text: "They see the schedule, book a spot or join the waitlist, and you mark who came." },
  ];
  return (
    <Card className="py-10">
      <div className="mx-auto max-w-2xl text-center">
        <CalendarDays className="mx-auto size-8 text-brand" />
        <p className="mt-3 text-lg font-medium">Set up group classes</p>
        <p className="mt-1 text-sm text-muted">Optional: only needed if your gym runs scheduled group sessions.</p>
        <ol className="mt-8 grid gap-6 text-left sm:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-3 sm:flex-col">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
                <s.icon className="size-4" />
              </span>
              <div>
                <p className="font-medium">{i + 1}. {s.title}</p>
                <p className="text-sm text-muted">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
        {isStaff ? (
          <div className="mt-8 flex justify-center"><ClassTypeDialog slug={slug} primary /></div>
        ) : (
          <p className="mt-8 text-sm text-muted">Ask the gym owner or staff to add class types.</p>
        )}
      </div>
    </Card>
  );
}
