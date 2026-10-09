"use client";

import { useActionState, useState } from "react";
import {
  formatDuration,
  formatMoney,
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
  type Plan,
} from "@gymos/shared";
import { useSavedToast } from "@/lib/use-saved-toast";
import { Button, Field, FormError, Input, Select } from "@/components/ui";
import { recordPayment } from "../actions";

export function RecordPaymentForm({
  slug,
  memberId,
  plans,
  currency,
  methods,
  onSaved,
}: {
  slug: string;
  memberId: string;
  plans: Plan[];
  currency: string;
  // Front-desk methods this gym accepts (Settings).
  methods: PaymentMethod[];
  onSaved?: () => void;
}) {
  const [state, action, pending] = useActionState(recordPayment, undefined);
  const [planId, setPlanId] = useState(plans[0].id);
  const plan = plans.find((p) => p.id === planId)!;

  useSavedToast(state, "Payment recorded", onSaved);

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
        <Select name="method" defaultValue={methods[0]}>
          {methods.map((m) => (
            <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
          ))}
        </Select>
      </Field>
      <Field label={`Amount received (${currency})`} hint="Change it for a discount.">
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
      <Button className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Record payment"}
      </Button>
    </form>
  );
}
