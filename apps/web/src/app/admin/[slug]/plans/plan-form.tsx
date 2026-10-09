"use client";

import { useActionState, useEffect, useState } from "react";
import { formatMoney, type Plan } from "@gymos/shared";
import { Pencil, Plus } from "lucide-react";
import { Modal } from "@/components/modal";
import { Button, Field, FormError, Input, Select } from "@/components/ui";
import { savePlan } from "./actions";

const DURATIONS = [
  { label: "1 month", days: 30 },
  { label: "3 months", days: 90 },
  { label: "6 months", days: 180 },
  { label: "1 year", days: 365 },
];

// "New plan" / "Edit" button that opens the plan form in a modal.
export function PlanDialog({ slug, currency, plan }: { slug: string; currency: string; plan?: Plan }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {plan ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-border/40"
        >
          <Pencil className="size-3.5" /> Edit
        </button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" /> New plan
        </Button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={plan ? `Edit ${plan.name}` : "New plan"}>
        <PlanForm slug={slug} currency={currency} plan={plan} onSaved={() => setOpen(false)} />
      </Modal>
    </>
  );
}

function PlanForm({ slug, currency, plan, onSaved }: { slug: string; currency: string; plan?: Plan; onSaved: () => void }) {
  const [state, action, pending] = useActionState(savePlan, undefined);
  const initialPreset = DURATIONS.find((d) => d.days === plan?.duration_days)?.days ?? (plan ? "custom" : 30);
  const [preset, setPreset] = useState<number | "custom">(initialPreset);
  const [customDays, setCustomDays] = useState(String(plan?.duration_days ?? 30));
  const [unlimited, setUnlimited] = useState(plan?.class_credits == null);
  const [price, setPrice] = useState(plan ? String(plan.price_paise / 100) : "");

  useEffect(() => {
    if (state?.saved) onSaved();
  }, [state, onSaved]);

  const days = preset === "custom" ? Number(customDays) || 0 : preset;
  const paise = Math.round(Number(price.replace(/,/g, "")) * 100) || 0;
  const perMonth = days >= 60 && paise > 0 ? formatMoney(Math.round((paise * 30) / days), currency) : null;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      {plan && <input type="hidden" name="id" value={plan.id} />}
      <input type="hidden" name="duration_days" value={days} />
      {unlimited && <input type="hidden" name="class_credits" value="" />}

      <Field label="Plan name">
        <Input name="name" defaultValue={plan?.name} placeholder="Monthly" required autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Price (${currency})`} hint={perMonth ? `≈ ${perMonth} per month` : undefined}>
          <Input name="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="1499" required />
        </Field>
        <Field label="Duration">
          <Select value={String(preset)} onChange={(e) => setPreset(e.target.value === "custom" ? "custom" : Number(e.target.value))}>
            {DURATIONS.map((d) => <option key={d.days} value={d.days}>{d.label}</option>)}
            <option value="custom">Custom…</option>
          </Select>
        </Field>
      </div>
      {preset === "custom" && (
        <Field label="Duration in days">
          <Input type="number" min={1} max={3660} value={customDays} onChange={(e) => setCustomDays(e.target.value)} required />
        </Field>
      )}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={unlimited} onChange={(e) => setUnlimited(e.target.checked)} className="size-4 accent-brand" />
          Unlimited classes
        </label>
        {!unlimited && (
          <Field label="Classes included">
            <Input name="class_credits" type="number" min={0} defaultValue={plan?.class_credits ?? 12} required />
          </Field>
        )}
      </div>
      <Field label="Description" hint="Shown to members in the app.">
        <Input name="description" defaultValue={plan?.description ?? ""} placeholder="Gym floor access, all day" />
      </Field>
      <Field label="Display order" hint="Lower numbers show first.">
        <Input name="sort_order" type="number" min={0} defaultValue={plan?.sort_order ?? 0} />
      </Field>
      <FormError message={state?.error} />
      <Button className="w-full" disabled={pending}>{pending ? "Saving…" : plan ? "Save changes" : "Create plan"}</Button>
    </form>
  );
}
