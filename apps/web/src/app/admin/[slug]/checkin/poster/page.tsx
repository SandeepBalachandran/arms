import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import QRCode from "qrcode";
import { posterCheckinUrl } from "@gymos/shared";
import { requireGym, STAFF_ROLES } from "@/lib/auth";
import { SITE_URL } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { PosterActions } from "./poster-actions";

export const metadata: Metadata = { title: "Check-in poster" };

// A4 poster for the entrance. Print it, or show this page on a tablet.
export default async function PosterPage({ params }: PageProps<"/admin/[slug]/checkin/poster">) {
  const { slug } = await params;
  const { gym, role } = await requireGym(slug, STAFF_ROLES);
  if (!gym.checkin_enabled || !gym.checkin_poster_enabled) notFound();

  const supabase = await createClient();
  const { data: key, error } = await supabase.rpc("checkin_poster_key", { p_gym_id: gym.id });
  if (error) throw error;
  const svg = await QRCode.toString(posterCheckinUrl(SITE_URL, gym.slug, key), {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: "#1f2a10", light: "#ffffff" },
  });

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/admin/${slug}/settings`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
          <ArrowLeft className="size-4" /> Settings
        </Link>
        <PosterActions slug={slug} canRotate={role === "owner" || role === "admin"} />
      </div>

      <article className="poster mx-auto flex aspect-[1/1.414] w-full max-w-[560px] flex-col items-center justify-between rounded-3xl border border-border bg-white p-10 text-center text-[#111] shadow-sm print:max-w-none print:rounded-none print:border-0 print:shadow-none">
        <header className="flex flex-col items-center gap-3">
          {gym.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element -- user upload on Supabase Storage
            <img src={gym.logo_url} alt="" className="size-16 rounded-2xl object-cover" />
          )}
          <h1 className="text-3xl font-extrabold tracking-tight">{gym.name}</h1>
          <p className="rounded-full bg-[#c8f04b] px-4 py-1 text-sm font-bold text-[#141a04]">Check in here</p>
        </header>

        <div className="w-[62%] rounded-3xl bg-white p-4 ring-8 ring-[#1f2a10]" dangerouslySetInnerHTML={{ __html: svg }} />

        <footer className="space-y-3">
          <ol className="flex justify-center gap-6 text-sm font-medium">
            <li><span className="mr-1 font-extrabold text-[#4d7c0f]">1</span> Open GOS</li>
            <li><span className="mr-1 font-extrabold text-[#4d7c0f]">2</span> Tap Scan to check in</li>
            <li><span className="mr-1 font-extrabold text-[#4d7c0f]">3</span> Point at this code</li>
          </ol>
          <p className="text-xs text-[#6b6b6b]">No app yet? Ask the front desk for the join link.</p>
        </footer>
      </article>
    </>
  );
}
