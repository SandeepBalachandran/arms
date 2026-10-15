import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Card } from "@/components/ui";
import { androidAppUrl, memberWebJoinUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { BRAND } from "@gymos/shared";

// The page behind the link gym owners share on WhatsApp. When the app is
// installed, Android App Links open the app instead and this page never shows.

const getGym = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("gyms")
    .select("name, slug, address, logo_url")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  return data;
});

export async function generateMetadata({ params }: PageProps<"/join/[slug]">): Promise<Metadata> {
  const gym = await getGym((await params).slug);
  if (!gym) return { title: "Gym not found" };
  const title = `Join ${gym.name} on ${BRAND.name}`;
  const description = "Membership, check-in, classes and workouts — all in one app.";
  return { title, description, openGraph: { title, description, type: "website" } };
}

export default async function JoinGymPage({ params }: PageProps<"/join/[slug]">) {
  const { slug } = await params;
  const gym = await getGym(slug);
  if (!gym) notFound();
  const webUrl = memberWebJoinUrl(gym.slug);
  const appUrl = androidAppUrl(gym.slug);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <Card className="space-y-5 p-6 text-center">
        {gym.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element -- user upload on Supabase Storage
          <img src={gym.logo_url} alt="" className="mx-auto size-20 rounded-2xl object-cover" />
        )}
        <p className="text-sm text-muted">You&apos;re invited to join</p>
        <h1 className="text-2xl font-semibold">{gym.name}</h1>
        {gym.address && <p className="text-sm text-muted">{gym.address}</p>}

        {/* Joining in the browser works for everyone; the Android app is extra, once there's a link. */}
        {webUrl && (
          <a href={webUrl} className="block rounded-lg bg-brand px-4 py-3 font-medium text-brand-fg">
            Join {gym.name}
          </a>
        )}
        {appUrl && (
          <a
            href={appUrl}
            className={webUrl ? "block rounded-lg border border-border px-4 py-3 font-medium hover:bg-border/40" : "block rounded-lg bg-brand px-4 py-3 font-medium text-brand-fg"}
          >
            Get the Android app
          </a>
        )}
        {webUrl && <p className="text-xs text-muted">Opens in your browser, no download. Add it to your home screen to use it like an app.</p>}

        <div className="rounded-lg border border-dashed border-border p-3">
          <p className="text-xs text-muted">Already have the app? Enter this gym code</p>
          <p className="mt-1 font-mono text-lg font-semibold tracking-wide">{gym.slug}</p>
        </div>
      </Card>
    </main>
  );
}
