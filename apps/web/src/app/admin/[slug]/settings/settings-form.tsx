"use client";

import { useActionState } from "react";
import { Button, Field, FormError, Input } from "@/components/ui";
import { updateGym, updateUpi } from "./actions";

type Gym = { name: string; address: string | null; phone: string | null; timezone: string };

export function SettingsForm({ slug, gym }: { slug: string; gym: Gym }) {
  const [state, action, pending] = useActionState(updateGym, undefined);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <Field label="Name">
        <Input name="name" defaultValue={gym.name} required />
      </Field>
      <Field label="Address">
        <Input name="address" defaultValue={gym.address ?? ""} />
      </Field>
      <Field label="Phone">
        <Input name="phone" type="tel" defaultValue={gym.phone ?? ""} />
      </Field>
      <Field label="Timezone" hint="Used for class times and daily check-in counts.">
        <Input name="timezone" defaultValue={gym.timezone} required />
      </Field>
      <FormError message={state?.error} />
      {state?.saved && <p className="text-sm text-muted">Saved.</p>}
      <Button disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
    </form>
  );
}

export function UpiForm({ slug, upiId, payeeName }: { slug: string; upiId: string | null; payeeName: string | null }) {
  const [state, action, pending] = useActionState(updateUpi, undefined);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <Field label="UPI ID" hint="Leave empty to turn off UPI payments in the app.">
        <Input name="upi_id" defaultValue={upiId ?? ""} placeholder="ironfit@okhdfcbank" autoCapitalize="none" />
      </Field>
      <Field label="Name on the UPI account" hint="Shown to members so they can check they're paying the right account.">
        <Input name="upi_payee_name" defaultValue={payeeName ?? ""} />
      </Field>
      <FormError message={state?.error} />
      {state?.saved && <p className="text-sm text-muted">Saved.</p>}
      <Button disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
    </form>
  );
}
