import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ScanLine } from "lucide-react";
import { Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Check in" };

// Opened when someone scans the gym's check-in poster with the phone's own
// camera instead of the GOS app: explain how to check in.
export default async function PosterLandingPage({ params }: PageProps<"/checkin/[slug]">) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: gym } = await supabase.from("gyms").select("name, slug, logo_url").eq("slug", slug).eq("status", "active").maybeSingle();
  if (!gym) notFound();

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <Card className="space-y-5 p-6 text-center">
        {gym.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element -- user upload on Supabase Storage
          <img src={gym.logo_url} alt="" className="mx-auto size-16 rounded-2xl object-cover" />
        )}
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand/15 text-brand">
          <ScanLine className="size-7" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Check in at {gym.name}</h1>
          <p className="text-sm text-muted">
            Scan this code from inside the GOS app: open GOS, tap <strong>Scan to check in</strong> on Home, and point it at the poster.
          </p>
        </div>
        <Link href={`/join/${gym.slug}`} className="block rounded-lg border border-border px-4 py-3 text-sm font-medium hover:bg-border/40">
          Don&apos;t have GOS yet? Get the app
        </Link>
      </Card>
    </main>
  );
}
