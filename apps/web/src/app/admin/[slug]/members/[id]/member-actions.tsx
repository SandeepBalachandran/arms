"use client";

import { useActionState, useState } from "react";
import { MoreHorizontal, Pencil, UserMinus, UserPlus, Wallet } from "lucide-react";
import type { PaymentMethod, Plan } from "@gymos/shared";
import { ActionForm } from "@/components/action-form";
import { Dropdown, menuItemClass } from "@/components/dropdown";
import { Modal } from "@/components/modal";
import { Tooltip } from "@/components/tooltip";
import { useSavedToast } from "@/lib/use-saved-toast";
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
        tooltip="More actions"
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
          <ActionForm action={setMemberActive} success={active ? "Removed from the gym" : "Restored to the gym"} confirm={active ? "Remove this person from the gym? They lose access until restored." : undefined}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="member_id" value={memberId} />
            <input type="hidden" name="active" value={active ? "false" : "true"} />
            <button role="menuitem" className={`${menuItemClass} ${active ? "text-danger" : ""}`}>
              {active ? <UserMinus className="size-4" /> : <UserPlus className="size-4" />}
              {active ? "Remove from gym" : "Restore to gym"}
            </button>
          </ActionForm>
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
  useSavedToast(state, "Member details saved", onSaved);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="member_id" value={memberId} />
      <Field label="Full name" inline>
        <Input name="full_name" defaultValue={fullName} required autoFocus />
      </Field>
      <Field label="Phone" inline>
        <Input name="phone" type="tel" defaultValue={phone} />
      </Field>
      <p className="text-xs text-muted">This updates the member&apos;s profile, which they also see in the app.</p>
      <FormError message={state?.error} />
      <Button className="w-full" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
    </form>
  );
}

// Pencil button that opens "Edit member details" (members table rows).
export function EditMemberButton({ slug, memberId, fullName, phone }: {
  slug: string;
  memberId: string;
  fullName: string;
  phone: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tooltip content="Edit details">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Edit ${fullName || "member"}`}
          className="rounded-lg p-2 text-muted hover:bg-border/40 hover:text-foreground"
        >
          <Pencil className="size-4" />
        </button>
      </Tooltip>
      <Modal open={open} onClose={() => setOpen(false)} title="Edit member details">
        <EditDetailsForm slug={slug} memberId={memberId} fullName={fullName} phone={phone} onSaved={() => setOpen(false)} />
      </Modal>
    </>
  );
}
