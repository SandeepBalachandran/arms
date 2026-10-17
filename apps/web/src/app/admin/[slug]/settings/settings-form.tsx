"use client";

import { useActionState, useState, type ReactNode } from "react";
import clsx from "clsx";
import { useSavedToast } from "@/lib/use-saved-toast";
import { Button, Card, FormError } from "@/components/ui";
import { saveSettings, type SettingsSection } from "./actions";

// A settings card with its own form and Save button. Fields are passed as
// children so the page can render them on the server.
export function SettingsCard({
  slug,
  section,
  title,
  description,
  className,
  readOnly,
  children,
}: {
  slug: string;
  section: SettingsSection;
  title: string;
  description?: ReactNode;
  className?: string;
  // Shown but locked when the owner hasn't given this person the permission.
  readOnly?: boolean;
  children: ReactNode;
}) {
  const [state, action, pending] = useActionState(saveSettings, undefined);
  useSavedToast(state, `${title} saved`);

  return (
    <Card className={clsx("h-fit", className)}>
      <h2 className="font-medium">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <form action={action} className="mt-4 space-y-4">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="section" value={section} />
        <fieldset disabled={readOnly} className="space-y-4 disabled:opacity-60">
          {children}
        </fieldset>
        <FormError message={state?.error} />
        {readOnly ? (
          <p className="text-xs text-muted">Only the owner, or someone they allow under Roles &amp; permissions, can change this.</p>
        ) : (
          <Button loading={pending}>{pending ? "Saving…" : "Save"}</Button>
        )}
      </form>
    </Card>
  );
}

// Renewal message textarea with a one-click reset to the default template.
export function RenewalMessageField({ defaultValue, fallback }: { defaultValue: string; fallback: string }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="space-y-1">
      <textarea
        name="renewal_message"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        maxLength={500}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
      />
      {value !== fallback && (
        <button type="button" onClick={() => setValue(fallback)} className="text-xs text-brand hover:underline">
          Reset to default
        </button>
      )}
    </div>
  );
}
