import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { requireGym, TEAM_ROLES } from "@/lib/auth";
import { joinUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { CopyJoinLink } from "./copy-join-link";

export const metadata: Metadata = { title: "Dashboard" };

export default async function AdminDashboard({ params }: PageProps<"/admin/[slug]">) {
  const { slug } = await params;
  const { gym } = await requireGym(slug, TEAM_ROLES);
  const supabase = await createClient();

  const [members, team] = await Promise.all([
    supabase.from("gym_members").select("id", { count: "exact", head: true })
      .eq("gym_id", gym.id).eq("role", "member").eq("status", "active"),
    supabase.from("gym_members").select("id", { count: "exact", head: true })
      .eq("gym_id", gym.id).neq("role", "member"),
  ]);

  const stats = [
    { label: "Active members", value: members.count ?? 0 },
    { label: "Team", value: team.count ?? 0 },
  ];

  return (
    <>
      <PageHeader title="Dashboard" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <p className="text-sm text-muted">{s.label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{s.value}</p>
          </Card>
        ))}
      </div>
      <Card className="mt-6">
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
    </>
  );
}
