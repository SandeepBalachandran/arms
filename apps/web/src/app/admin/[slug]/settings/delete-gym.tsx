"use client";

import { useActionState, useState } from "react";
import { Download, Loader2, Trash2 } from "lucide-react";
import { Modal } from "@/components/modal";
import { Button, Card, FormError, Input } from "@/components/ui";
import { deleteGym } from "./delete-actions";

// Owners only. Type-to-confirm, with the data download offered first.
export function DeleteGymCard({ slug, gymName }: { slug: string; gymName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="space-y-3 border-danger/40 lg:col-span-2">
      <div>
        <h2 className="font-semibold text-danger">Delete gym</h2>
        <p className="mt-1 text-sm text-muted">
          Closes {gymName} for everyone straight away. You can restore it for 30 days; after that its members&apos; memberships, payments,
          check-ins, classes and notes are deleted for good.
        </p>
      </div>
      <Button variant="danger" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" /> Delete this gym
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Delete ${gymName}?`}>
        <DeleteGymForm slug={slug} />
      </Modal>
    </Card>
  );
}

function DeleteGymForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(deleteGym, undefined);
  const [confirm, setConfirm] = useState("");
  const matches = confirm.trim().toLowerCase() === slug;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>The admin panel, the member app and the join link stop working for this gym now.</li>
        <li>Any owner can restore it from the admin home for the next <strong>30 days</strong>.</li>
        <li>After that, all of the gym&apos;s data is deleted permanently. Member accounts stay, since they can belong to other gyms.</li>
      </ul>

      <div className="rounded-xl border border-border bg-background p-3">
        <p className="text-sm font-medium">Keep a copy first</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <a href={`/admin/${slug}/export/members`} className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm hover:bg-border/40">
            <Download className="size-4" /> Members (CSV)
          </a>
          <a href={`/admin/${slug}/export/payments`} className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm hover:bg-border/40">
            <Download className="size-4" /> Payments (CSV)
          </a>
        </div>
      </div>

      <label className="block space-y-1">
        <span className="text-sm">
          Type <code className="rounded bg-border/50 px-1 font-mono">{slug}</code> to confirm
        </span>
        <Input name="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" spellCheck={false} />
      </label>
      <FormError message={state?.error} />
      <Button variant="danger" className="w-full" disabled={!matches || pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        {pending ? "Deleting…" : "Delete gym"}
      </Button>
    </form>
  );
}
