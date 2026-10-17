"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteMyAccount } from "@/app/account/actions";
import { Modal } from "@/components/modal";
import { Button, FormError, Input } from "@/components/ui";

// Type-to-confirm. Explains what goes and what the gym keeps.
export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="danger" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" /> Delete my account
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Delete your account?">
        <DeleteAccountForm />
      </Modal>
    </>
  );
}

function DeleteAccountForm() {
  const [state, action, pending] = useActionState(deleteMyAccount, undefined);
  const [confirm, setConfirm] = useState("");

  return (
    <form action={action} className="space-y-4">
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>You&apos;re signed out and can&apos;t sign in to this account again.</li>
        <li>Your name, phone, photo, workouts, body measurements, food log and the team&apos;s notes about you are deleted.</li>
        <li>
          Your gyms keep their records of payments, receipts, memberships and visits, as they need them for their accounts. These show as
          &ldquo;Deleted member&rdquo;.
        </li>
        <li>If you own a gym, delete the gym in Settings first.</li>
      </ul>
      <label className="block space-y-1">
        <span className="text-sm">
          Type <code className="rounded bg-border/50 px-1 font-mono">DELETE</code> to confirm
        </span>
        <Input name="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" spellCheck={false} />
      </label>
      <FormError message={state?.error} />
      <Button variant="danger" className="w-full" loading={pending} disabled={confirm.trim().toUpperCase() !== "DELETE" || pending}>
        {pending ? "Deleting…" : "Delete my account"}
      </Button>
    </form>
  );
}
