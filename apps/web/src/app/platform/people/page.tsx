import type { Metadata } from "next";
import Link from "next/link";
import { rolesLabel } from "@gymos/shared";
import { Button, Card, Input, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { ago, date } from "../format";

export const metadata: Metadata = { title: "People" };

// Find a person by name, email or phone: their account and every gym they're
// in, with their roles. Each search is logged.
export default async function PlatformPeoplePage({ searchParams }: PageProps<"/platform/people">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";

  let error: string | null = null;
  let people: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    signedUp: string;
    lastSignIn: string | null;
    gyms: { id: string; name: string; slug: string; roles: string; status: string }[];
  }[] = [];

  if (query.length >= 3) {
    const supabase = await createClient();
    const res = await supabase.rpc("platform_find_people", { p_query: query });
    if (res.error) error = res.error.message;
    else {
      const byUser = new Map<string, (typeof people)[number]>();
      for (const r of res.data) {
        const p = byUser.get(r.user_id) ?? {
          id: r.user_id,
          name: r.full_name,
          email: r.email,
          phone: r.phone,
          signedUp: r.signed_up_at,
          lastSignIn: r.last_sign_in_at,
          gyms: [],
        };
        if (r.gym_id && r.role) {
          p.gyms.push({ id: r.gym_id, name: r.gym_name ?? "", slug: r.gym_slug ?? "", roles: rolesLabel(r.role, r.extra_roles ?? []), status: r.member_status ?? "" });
        }
        byUser.set(r.user_id, p);
      }
      people = [...byUser.values()];
    }
  } else if (query) {
    error = "Type at least 3 characters";
  }

  return (
    <>
      <PageHeader title="People" />
      <form className="mb-6 flex max-w-xl gap-2">
        <Input name="q" defaultValue={query} placeholder="Name, email or phone" autoFocus />
        <Button>Search</Button>
      </form>
      {error && <p className="mb-4 text-sm text-danger">{error}</p>}
      {query.length >= 3 && !error && people.length === 0 && <Card className="text-sm text-muted">Nobody matches “{query}”.</Card>}
      <ul className="space-y-2">
        {people.map((p) => (
          <li key={p.id}>
            <Card>
              <p className="font-medium">{p.name || "No name"}</p>
              <p className="truncate text-xs text-muted">
                {p.email}
                {p.phone ? ` · ${p.phone}` : ""} · signed up {date(p.signedUp)} · last signed in {ago(p.lastSignIn)}
              </p>
              {p.gyms.length === 0 ? (
                <p className="mt-2 text-sm text-muted">Not in any gym.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  {p.gyms.map((g) => (
                    <li key={g.id}>
                      <Link href={`/platform/gyms/${g.id}`} className="hover:underline">
                        {g.name}
                      </Link>{" "}
                      <span className="text-muted">
                        · {g.roles}
                        {g.status !== "active" ? ` (${g.status})` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
