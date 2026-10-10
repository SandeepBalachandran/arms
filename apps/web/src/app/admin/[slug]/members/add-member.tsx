"use client";

import { useActionState, useState } from "react";
import clsx from "clsx";
import { UserPlus } from "lucide-react";
import { Modal } from "@/components/modal";
import { Button, Field, FormError, Input } from "@/components/ui";
import { CopyJoinLink } from "../copy-join-link";
import { addMember } from "./actions";

type Tab = "manual" | "invite";

// "Add member" button: add someone directly at the front desk, or share the
// join link so they sign themselves up in the app.
export function AddMember({
  slug,
  gymName,
  whatsappHref,
  countryCode,
}: {
  slug: string;
  gymName: string;
  whatsappHref: string;
  countryCode: string;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("manual");

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="size-4" /> Add member
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add a member">
        <div role="tablist" className="mb-5 grid grid-cols-2 rounded-lg border border-border p-1 text-sm">
          {(
            [
              ["manual", "Add manually"],
              ["invite", "Share invite link"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={clsx(
                "rounded-md py-1.5 font-medium",
                tab === value ? "bg-brand text-brand-fg" : "text-muted hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "manual" ? (
          <ManualForm slug={slug} countryCode={countryCode} />
        ) : (
          <div className="space-y-4 text-sm">
            <p className="text-muted">
              Send this link on WhatsApp. It opens the GOS app (or the Play Store) and joins {gymName}.
            </p>
            <CopyJoinLink path={`/join/${slug}`} />
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center rounded-lg bg-[#25D366] px-4 py-2 font-medium text-white"
            >
              Share on WhatsApp
            </a>
            <p className="text-muted">
              Or ask them to type the gym code <span className="font-mono font-semibold text-foreground">{slug}</span> in the app.
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}

function ManualForm({ slug, countryCode }: { slug: string; countryCode: string }) {
  const [state, action, pending] = useActionState(addMember, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <Field label="Full name">
        <Input name="full_name" autoComplete="off" required autoFocus />
      </Field>
      <Field label="Phone" hint={`Local numbers get +${countryCode}.`}>
        <Input name="phone" type="tel" autoComplete="off" placeholder="98765 43210" />
      </Field>
      <Field label="Email (optional)" hint="With an email they can sign in to the app later and see their membership.">
        <Input name="email" type="email" autoComplete="off" />
      </Field>
      <FormError message={state?.error} />
      <Button className="w-full" disabled={pending}>
        {pending ? "Adding…" : "Add member"}
      </Button>
      <p className="text-center text-xs text-muted">Next you can record their first payment.</p>
    </form>
  );
}
