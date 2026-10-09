"use client";

import { useActionState, useState } from "react";
import {
  formatDuration,
  formatMoney,
  MANUAL_PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  type Plan,
} from "@gymos/shared";
import { Button, Field, FormError, Input, Select } from "@/components/ui";
import { recordPayment } from "../actions";

export function RecordPaymentForm({
  slug,
  memberId,
  plans,
  currency,
}: {
  slug: string;
  memberId: string;
  plans: Plan[];
  currency: string;
}) {
  const [state, action, pending] = useActionState(recordPayment, undefined);
  const [planId, setPlanId] = useState(plans[0].id);
  const plan = plans.find((p) => p.id === planId)!;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="member_id" value={memberId} />
      <Field label="Plan">
        <Select name="plan_id" value={planId} onChange={(e) => setPlanId(e.target.value)}>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {formatMoney(p.price_paise, currency)} · {formatDuration(p.duration_days)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Method">
        <Select name="method" defaultValue="cash">
          {MANUAL_PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
          ))}
        </Select>
      </Field>
      <Field label="Amount received (₹)" hint="Change it for a discount.">
        <Input
          key={plan.id}
          name="amount"
          inputMode="decimal"
          defaultValue={String(plan.price_paise / 100)}
          required
        />
      </Field>
      <Field label="Start date" hint="Leave empty to start automatically.">
        <Input name="starts_on" type="date" />
      </Field>
      <Field label="Note">
        <Input name="note" placeholder="UPI ref, discount reason…" maxLength={300} />
      </Field>
      <FormError message={state?.error} />
      {state?.saved && <p className="text-sm text-muted">Payment recorded.</p>}
      <Button className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Record payment"}
      </Button>
    </form>
  );
}
