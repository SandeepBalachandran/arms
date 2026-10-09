"use client";

import { useActionState } from "react";
import { Button, Field, FormError, Input } from "@/components/ui";
import { updateProfile } from "./actions";

export function ProfileForm({ fullName, phone }: { fullName: string; phone: string }) {
  const [state, action, pending] = useActionState(updateProfile, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label="Full name">
        <Input name="full_name" defaultValue={fullName} autoComplete="name" required />
      </Field>
      <Field label="Phone" hint="Used by your gym to reach you, e.g. WhatsApp reminders.">
        <Input name="phone" type="tel" defaultValue={phone} autoComplete="tel" />
      </Field>
      <FormError message={state?.error} />
      {state?.saved && <p className="text-sm text-muted">Saved.</p>}
      <Button disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
    </form>
  );
}
