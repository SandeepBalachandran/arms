import type { Metadata } from "next";
import {
  CURRENCIES,
  GYM_DEFAULTS,
  MANUAL_PAYMENT_METHODS,
  parseOpeningHours,
  PAYMENT_METHOD_LABELS,
  RENEWAL_MESSAGE_PLACEHOLDERS,
  timezoneOptions,
} from "@gymos/shared";
import { Field, Input, PageHeader, Select } from "@/components/ui";
import { requireGym } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DeleteGymCard } from "./delete-gym";
import { HoursEditor } from "./hours-editor";
import { RenewalMessageField, SettingsCard } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

// A checkbox that always submits "true" or "false".
function Toggle({ name, label, hint, defaultChecked }: { name: string; label: string; hint?: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-start gap-3">
      <input type="hidden" name={name} value="false" />
      <input type="checkbox" name={name} value="true" defaultChecked={defaultChecked} className="mt-1 size-4 accent-brand" />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export default async function SettingsPage({ params }: PageProps<"/admin/[slug]/settings">) {
  const { slug } = await params;
  const { gym, role } = await requireGym(slug, ["owner", "admin"]);
  const supabase = await createClient();
  const { data: g, error } = await supabase.from("gyms").select("*").eq("id", gym.id).single();
  if (error) throw error;
  const timezones = timezoneOptions(g.timezone);

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
        <SettingsCard slug={slug} section="general" title="Gym profile">
          <Field label="Name">
            <Input name="name" defaultValue={g.name} required />
          </Field>
          <Field label="Address">
            <Input name="address" defaultValue={g.address ?? ""} />
          </Field>
          <Field label="Phone">
            <Input name="phone" type="tel" defaultValue={g.phone ?? ""} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Currency" hint={`Default ${GYM_DEFAULTS.currency}`}>
              <Select name="currency" defaultValue={g.currency}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Phone country code" hint={`For WhatsApp links. Default +${GYM_DEFAULTS.phone_country_code}`}>
              <Input name="phone_country_code" inputMode="numeric" defaultValue={g.phone_country_code} required />
            </Field>
          </div>
          <Field label="Timezone" hint={`Used for class times, expiry dates and daily counts. Default ${GYM_DEFAULTS.timezone}`}>
            <Select name="timezone" defaultValue={g.timezone}>
              {timezones.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </Select>
          </Field>
        </SettingsCard>

        <SettingsCard
          slug={slug}
          section="hours"
          title="Opening hours"
          description="Shown to members in the app with “Open now” or when you open next. Untick a session to close it that day."
          className="lg:col-span-2"
        >
          <HoursEditor defaultValue={parseOpeningHours(g.opening_hours)} />
          <Field label="Note for members" hint="Optional, e.g. holiday timings or a ladies-only hour.">
            <Input name="opening_hours_note" defaultValue={g.opening_hours_note ?? ""} maxLength={200} placeholder="Closed on national holidays" />
          </Field>
        </SettingsCard>

        <SettingsCard slug={slug} section="memberships" title="Memberships & joining">
          <Field label="Warn before expiry (days)" hint={`Members are flagged as “expiring soon” this many days before their plan ends. Default ${GYM_DEFAULTS.expiry_warning_days}`}>
            <Input name="expiry_warning_days" type="number" min={1} max={60} defaultValue={g.expiry_warning_days} required />
          </Field>
          <Field
            label="Renewal reminder message"
            hint={`Sent from the dashboard’s WhatsApp “Remind” button. Placeholders: ${RENEWAL_MESSAGE_PLACEHOLDERS.join(" ")}`}
          >
            <RenewalMessageField defaultValue={g.renewal_message} fallback={GYM_DEFAULTS.renewal_message} />
          </Field>
          <Field label="Receipt prefix" hint="Shown before receipt numbers, e.g. DF- gives DF-12. Empty shows #12.">
            <Input name="receipt_prefix" defaultValue={g.receipt_prefix} maxLength={10} />
          </Field>
          <fieldset>
            <legend className="mb-1 text-sm font-medium">Payment methods at the front desk</legend>
            <div className="flex flex-wrap gap-3">
              {MANUAL_PAYMENT_METHODS.map((m) => (
                <label key={m} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="manual_payment_methods"
                    value={m}
                    defaultChecked={g.manual_payment_methods.includes(m)}
                    className="size-4 accent-brand"
                  />
                  {PAYMENT_METHOD_LABELS[m]}
                </label>
              ))}
            </div>
          </fieldset>
          <Toggle
            name="join_requires_approval"
            label="Approve new members"
            hint="People who open your join link wait until staff approve them on the Members page."
            defaultChecked={g.join_requires_approval}
          />
        </SettingsCard>

        <SettingsCard
          slug={slug}
          section="upi"
          title="UPI payments"
          description={
            g.currency === "INR"
              ? "Members pay this UPI ID from the app, then tap “I’ve paid”. You confirm each payment on the Payments page. No fees. Leave empty to turn off."
              : "UPI is only available when the gym’s currency is INR."
          }
        >
          <Field label="UPI ID">
            <Input name="upi_id" defaultValue={g.upi_id ?? ""} placeholder="yourgym@okhdfcbank" autoCapitalize="none" />
          </Field>
          <Field label="Name on the UPI account" hint="Shown to members so they know they’re paying the right account.">
            <Input name="upi_payee_name" defaultValue={g.upi_payee_name ?? ""} />
          </Field>
        </SettingsCard>

        <SettingsCard slug={slug} section="checkin" title="Check-in" description="Optional. Nobody is ever turned away; expired memberships are only flagged.">
          <Toggle name="checkin_enabled" label="Use check-in" defaultChecked={g.checkin_enabled} />
          <Toggle
            name="checkin_self_allowed"
            label="Members can check themselves in"
            hint="Off: only staff can check members in (QR scan or by name)."
            defaultChecked={g.checkin_self_allowed}
          />
          <Field label="Count repeat check-ins within (hours) as one visit" hint={`0 counts every check-in. Default ${GYM_DEFAULTS.checkin_dedupe_hours}`}>
            <Input name="checkin_dedupe_hours" type="number" min={0} max={24} defaultValue={g.checkin_dedupe_hours} required />
          </Field>
        </SettingsCard>

        <SettingsCard slug={slug} section="classes" title="Classes" description="Optional. Group classes members book in the app.">
          <Toggle name="classes_enabled" label="Run classes" defaultChecked={g.classes_enabled} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Booking opens (days ahead)" hint={`Default ${GYM_DEFAULTS.classes_booking_window_days}`}>
              <Input name="classes_booking_window_days" type="number" min={1} max={60} defaultValue={g.classes_booking_window_days} required />
            </Field>
            <Field label="Cancel up to (hours before)" hint={`0 allows cancelling any time. Default ${GYM_DEFAULTS.classes_cancel_cutoff_hours}`}>
              <Input name="classes_cancel_cutoff_hours" type="number" min={0} max={72} defaultValue={g.classes_cancel_cutoff_hours} required />
            </Field>
          </div>
          <Toggle
            name="classes_require_membership"
            label="Require an active membership to book"
            hint="Off: anyone in the gym can book."
            defaultChecked={g.classes_require_membership}
          />
        </SettingsCard>

        <SettingsCard
          slug={slug}
          section="workouts"
          title="Workouts & progress"
          description="Optional. Trainers build and assign plans; members log workouts and measurements. Choose which built-in exercises to offer on the Workouts page."
        >
          <Toggle name="workouts_enabled" label="Use workouts & progress" defaultChecked={g.workouts_enabled} />
        </SettingsCard>

        <SettingsCard
          slug={slug}
          section="pt"
          title="Personal training"
          description="Optional. Sell PT packages (a number of sessions, or unlimited for a period), assign a trainer, and track sessions used. Set up packages on the Personal training page."
        >
          <Toggle name="pt_enabled" label="Offer personal training" defaultChecked={g.pt_enabled} />
          <Toggle
            name="pt_show_in_app"
            label="Show PT packages and prices in the app"
            hint="Members always see their own PT sessions. Off: packages are only sold at the front desk."
            defaultChecked={g.pt_show_in_app}
          />
          <Field label="Flag clients with this many sessions left" hint={`They’re marked “running low” so you can offer a renewal. Default ${GYM_DEFAULTS.pt_expiry_warning_sessions}`}>
            <Input name="pt_expiry_warning_sessions" type="number" min={0} max={50} defaultValue={g.pt_expiry_warning_sessions} required />
          </Field>
        </SettingsCard>

        {role === "owner" && <DeleteGymCard slug={slug} gymName={g.name} />}
      </div>
    </>
  );
}
