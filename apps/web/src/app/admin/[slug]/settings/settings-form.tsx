"use client";

import { useActionState } from "react";
import { Button, Field, FormError, Input } from "@/components/ui";
import { updateGym } from "./actions";

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
