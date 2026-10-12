"use client";

import { useActionState } from "react";
import { useSavedToast } from "@/lib/use-saved-toast";
import { Button, Field, FormError } from "@/components/ui";
import { PasswordInput } from "@/components/password-input";
import { changePassword } from "./actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  useSavedToast(state, "Password updated");
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="New password">
          <PasswordInput name="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <Field label="Confirm password">
          <PasswordInput name="confirm" autoComplete="new-password" minLength={8} required />
        </Field>
      </div>
      <FormError message={state?.error} />
      <Button variant="secondary" disabled={pending}>{pending ? "Saving…" : "Update password"}</Button>
    </form>
  );
}
