import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { todayIn } from "@gymos/shared";
import { QrCode } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Badge, Card, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { signAvatars } from "@/lib/avatars";
import { createClient } from "@/lib/supabase/server";
import { hoursAgo } from "@/lib/time";
import { CheckInRow } from "./check-in-button";
import { LiveRefresh } from "./live-refresh";
import { Scanner } from "./scanner";

export const metadata: Metadata = { title: "Check-in" };

const METHOD_LABELS = { self: "App", scan: "Scan", manual: "Desk", poster: "QR poster" } as const;

export default async function CheckinPage({ params, searchParams }: PageProps<"/admin/[slug]/checkin">) {
  const { slug } = await params;
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const { gym } = await requirePermission(slug, "check_in_members");
  if (!gym.checkin_enabled) notFound();

  const supabase = await createClient();
  const today = todayIn(gym.timezone);
  const since = hoursAgo(36);

  const [recent, matches] = await Promise.all([
    supabase
      .from("checkins")
      .select("id, checked_in_at, method, membership_ok, member_id, gym_members!inner(profiles!inner(full_name, avatar_url))")
      .eq("gym_id", gym.id)
      .gte("checked_in_at", since)
      .order("checked_in_at", { ascending: false }),
    query
      ? supabase
          .from("gym_members")
          .select("id, profiles!inner(full_name, phone, avatar_url)")
          .eq("gym_id", gym.id)
          .eq("status", "active")
          .ilike("profiles.full_name", `%${query}%`)
          .limit(10)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (recent.error) throw recent.error;
  if (matches.error) throw matches.error;

  const todays = recent.data.filter((c) => todayIn(gym.timezone, new Date(c.checked_in_at)) === today);
  const photos = await signAvatars([
    ...todays.map((c) => c.gym_members.profiles.avatar_url),
    ...matches.data.map((m) => m.profiles.avatar_url),
  ]);
  const photo = (path: string | null) => (path ? photos.get(path) : null);

  return (
    <>
      <LiveRefresh gymId={gym.id} />
      <PageHeader
        title="Check-in"
        actions={
          gym.checkin_poster_enabled && (
            <Link href={`/admin/${slug}/checkin/poster`} className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium hover:bg-border/40">
              <QrCode className="size-4" /> QR poster
            </Link>
          )
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-medium">Scan member QR</h2>
            <Scanner slug={slug} />
          </Card>
          <Card>
            <h2 className="mb-3 font-medium">Check in by name</h2>
            <form className="flex gap-2">
              <input
                name="q"
                defaultValue={query}
                placeholder="Member name"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              />
              <button className="rounded-lg border border-border px-3 py-2 text-sm">Search</button>
            </form>
            {query && (
              <ul className="mt-3 divide-y divide-border">
                {matches.data.map((m) => (
                  <li key={m.id} className="py-2 text-sm">
                    <CheckInRow slug={slug} memberId={m.id}>
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={m.profiles.full_name || "?"} src={photo(m.profiles.avatar_url)} size="md" />
                        <div className="min-w-0">
                          <p className="font-medium">{m.profiles.full_name || "Unnamed member"}</p>
                          <p className="text-muted">{m.profiles.phone ?? ""}</p>
                        </div>
                      </div>
                    </CheckInRow>
                  </li>
                ))}
                {matches.data.length === 0 && <li className="py-2 text-sm text-muted">No member found.</li>}
              </ul>
            )}
          </Card>
        </div>

        <Card className="h-fit">
          <h2 className="font-medium">Today · {todays.length} {todays.length === 1 ? "visit" : "visits"}</h2>
          <ul className="mt-3 divide-y divide-border text-sm">
            {todays.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                <Link href={`/admin/${slug}/members/${c.member_id}`} className="flex min-w-0 items-center gap-2.5 hover:underline">
                  <Avatar name={c.gym_members.profiles.full_name || "?"} src={photo(c.gym_members.profiles.avatar_url)} size="sm" />
                  {c.gym_members.profiles.full_name || "Unnamed member"}
                </Link>
                <span className="flex items-center gap-2">
                  {!c.membership_ok && <Badge tone="warn">No active plan</Badge>}
                  <Badge>{METHOD_LABELS[c.method]}</Badge>
                  <span className="w-16 text-right text-muted">
                    {new Date(c.checked_in_at).toLocaleTimeString("en-IN", { timeZone: gym.timezone, timeStyle: "short" })}
                  </span>
                </span>
              </li>
            ))}
            {todays.length === 0 && <li className="py-2 text-muted">No one has checked in yet today.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
