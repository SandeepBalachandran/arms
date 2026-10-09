"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { Plan } from "@gymos/shared";
import { Button, Field, FormError, Input } from "@/components/ui";
import { savePlan } from "./actions";

const DURATION_PRESETS = [
  { label: "1 month", days: 30 },
  { label: "3 months", days: 90 },
  { label: "6 months", days: 180 },
  { label: "1 year", days: 365 },
];

export function PlanForm({ slug, plan }: { slug: string; plan?: Plan }) {
  const [state, action, pending] = useActionState(savePlan, undefined);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      {plan && <input type="hidden" name="id" value={plan.id} />}
      <Field label="Name">
        <Input name="name" defaultValue={plan?.name} placeholder="Monthly" required />
      </Field>
      <Field label="Price (₹)">
        <Input
          name="price"
          inputMode="decimal"
          defaultValue={plan ? String(plan.price_paise / 100) : ""}
          placeholder="1499"
          required
        />
      </Field>
      <Field label="Duration (days)" hint={DURATION_PRESETS.map((p) => `${p.label} = ${p.days}`).join(" · ")}>
        <Input name="duration_days" type="number" min={1} defaultValue={plan?.duration_days ?? 30} required />
      </Field>
      <Field label="Class credits" hint="Leave empty for unlimited classes.">
        <Input name="class_credits" type="number" min={0} defaultValue={plan?.class_credits ?? ""} />
      </Field>
      <Field label="Description">
        <Input name="description" defaultValue={plan?.description ?? ""} placeholder="Gym floor access, all day" />
      </Field>
      <Field label="Sort order" hint="Lower numbers show first in the app.">
        <Input name="sort_order" type="number" min={0} defaultValue={plan?.sort_order ?? 0} />
      </Field>
      <FormError message={state?.error} />
      <div className="flex gap-2">
        <Button disabled={pending}>{pending ? "Saving…" : plan ? "Save changes" : "Create plan"}</Button>
        {plan && (
          <Link href={`/admin/${slug}/plans`} className="rounded-lg px-4 py-2 text-sm text-muted hover:bg-border/40">
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}
