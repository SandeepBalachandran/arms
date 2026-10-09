"use client";

import { useActionState, useEffect, useState } from "react";
import { MoreHorizontal, Pencil, UserMinus, UserPlus, Wallet } from "lucide-react";
import type { PaymentMethod, Plan } from "@gymos/shared";
import { Dropdown, menuItemClass } from "@/components/dropdown";
import { Modal } from "@/components/modal";
import { Button, Field, FormError, Input } from "@/components/ui";
import { setMemberActive, updateMemberDetails } from "../actions";
import { RecordPaymentForm } from "./record-payment-form";

// "Record payment" / "Renew" button that opens the payment form in a modal.
export function RecordPaymentButton({
  label,
  hint,
  variant = "primary",
  ...form
}: {
  label: string;
  hint: string;
  variant?: "primary" | "secondary";
  slug: string;
  memberId: string;
  plans: Plan[];
  currency: string;
  methods: PaymentMethod[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)} disabled={form.plans.length === 0}>
        <Wallet className="size-4" /> {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={label}>
        <p className="mb-4 text-sm text-muted">{hint}</p>
        <RecordPaymentForm {...form} onSaved={() => setOpen(false)} />
      </Modal>
    </>
  );
}

// ⋯ menu: edit name/phone, remove from (or restore to) the gym.
export function MemberMenu({
  slug,
  memberId,
  fullName,
  phone,
  active,
  canRemove,
}: {
  slug: string;
  memberId: string;
  fullName: string;
  phone: string;
  active: boolean;
  canRemove: boolean;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <>
      <Dropdown
        label="More actions"
        trigger={
          <span className="flex size-9 items-center justify-center rounded-lg border border-border hover:bg-border/40">
            <MoreHorizontal className="size-4" />
          </span>
        }
      >
        <button type="button" role="menuitem" className={menuItemClass} onClick={() => setEditing(true)}>
          <Pencil className="size-4 text-muted" /> Edit details
        </button>
        {canRemove && (
          <form action={setMemberActive}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="member_id" value={memberId} />
            <input type="hidden" name="active" value={active ? "false" : "true"} />
            <button role="menuitem" className={`${menuItemClass} ${active ? "text-danger" : ""}`}>
              {active ? <UserMinus className="size-4" /> : <UserPlus className="size-4" />}
              {active ? "Remove from gym" : "Restore to gym"}
            </button>
          </form>
        )}
      </Dropdown>
      <Modal open={editing} onClose={() => setEditing(false)} title="Edit member details">
        <EditDetailsForm slug={slug} memberId={memberId} fullName={fullName} phone={phone} onSaved={() => setEditing(false)} />
      </Modal>
    </>
  );
}

function EditDetailsForm({ slug, memberId, fullName, phone, onSaved }: {
  slug: string;
  memberId: string;
  fullName: string;
  phone: string;
  onSaved: () => void;
}) {
  const [state, action, pending] = useActionState(updateMemberDetails, undefined);
  useEffect(() => {
    if (state?.saved) onSaved();
  }, [state, onSaved]);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="member_id" value={memberId} />
      <Field label="Full name">
        <Input name="full_name" defaultValue={fullName} required autoFocus />
      </Field>
      <Field label="Phone">
        <Input name="phone" type="tel" defaultValue={phone} />
      </Field>
      <p className="text-xs text-muted">This updates the member&apos;s profile, which they also see in the app.</p>
      <FormError message={state?.error} />
      <Button className="w-full" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
    </form>
  );
}
