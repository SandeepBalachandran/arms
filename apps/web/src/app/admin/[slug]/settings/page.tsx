import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { requireGym } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { updateCheckin } from "./actions";
import { SettingsForm, UpiForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ params }: PageProps<"/admin/[slug]/settings">) {
  const { slug } = await params;
  const { gym } = await requireGym(slug, ["owner", "admin"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("gyms")
    .select("name, address, phone, timezone, upi_id, upi_payee_name, checkin_enabled")
    .eq("id", gym.id)
    .single();

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
        <Card className="h-fit">
          <h2 className="mb-4 font-medium">Gym profile</h2>
          <SettingsForm slug={slug} gym={data!} />
        </Card>
        <Card className="h-fit">
          <h2 className="font-medium">UPI payments</h2>
          <p className="mb-4 mt-1 text-sm text-muted">
            Members pay this UPI ID from the app, then tap &ldquo;I&apos;ve paid&rdquo;. You confirm each payment on the
            Payments page after checking your UPI app. No fees.
          </p>
          <UpiForm slug={slug} upiId={data!.upi_id} payeeName={data!.upi_payee_name} />
        </Card>
        <Card className="h-fit">
          <h2 className="font-medium">Check-in</h2>
          <p className="mt-1 text-sm text-muted">
            Optional. When on, members can tap &ldquo;Check in&rdquo; in the app, and staff can scan a member&apos;s QR code
            or check them in by hand. Nobody is ever turned away; expired memberships are only flagged.
          </p>
          <form action={updateCheckin} className="mt-4 flex items-center gap-3">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="enabled" value={data!.checkin_enabled ? "false" : "true"} />
            <span className="text-sm">
              Currently <strong>{data!.checkin_enabled ? "on" : "off"}</strong>
            </span>
            <button className="rounded-lg border border-border px-3 py-1.5 text-sm">
              Turn {data!.checkin_enabled ? "off" : "on"}
            </button>
          </form>
        </Card>
      </div>
    </>
  );
}
