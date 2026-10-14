import type { Metadata } from "next";
import QRCode from "qrcode";
import { Card, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { joinUrl } from "@/lib/site";
import { ApprovalToggle } from "./approval-toggle";
import { ShareCard } from "./share-card";

export const metadata: Metadata = { title: "Join link" };

export default async function JoinLinkPage({ params }: PageProps<"/admin/[slug]/join">) {
  const { slug } = await params;
  const { gym, can } = await requirePermission(slug, "manage_members");
  const url = joinUrl(gym.slug);
  const svg = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#1f2a10", light: "#ffffff" } });

  return (
    <>
      <PageHeader title="Join link" />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <ShareCard
            path={`/join/${gym.slug}`}
            url={url}
            defaultMessage={`💪 ${gym.name} is on the GOS app! Book classes, check in with your phone, pay by UPI and track workouts.\n\nJoin here 👉`}
          />
          <Card>
            <h2 className="font-medium">Who can join</h2>
            <div className="mt-2">
              <ApprovalToggle slug={slug} on={gym.join_requires_approval} locked={!can("manage_sections")} />
            </div>
          </Card>
        </div>
        <Card className="h-fit text-center">
          <h2 className="font-medium">QR code</h2>
          <p className="mt-1 text-sm text-muted">Print it for the front desk. Phones that scan it open the join page.</p>
          <div className="mx-auto mt-4 w-56 rounded-2xl bg-white p-3 ring-4 ring-[#1f2a10]" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="mt-3 text-xs text-muted">Gym code: <span className="font-mono font-medium text-foreground">{gym.slug}</span></p>
        </Card>
      </div>
    </>
  );
}
