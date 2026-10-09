"use client";

import { useActionState } from "react";
import { Button, Field, FormError, Input } from "@/components/ui";
import { changePassword } from "./actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="New password">
          <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <Field label="Confirm password">
          <Input name="confirm" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
      </div>
      <FormError message={state?.error} />
      {state?.saved && <p className="text-sm text-muted">Password updated.</p>}
      <Button variant="secondary" disabled={pending}>{pending ? "Saving…" : "Update password"}</Button>
    </form>
  );
}
