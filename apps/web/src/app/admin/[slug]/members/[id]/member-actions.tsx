"use client";

import { Suspense, use, useActionState, useState, useTransition } from "react";
import { Copy, KeyRound, MoreHorizontal, Pencil, UserMinus, UserPlus, Wallet } from "lucide-react";
import toast from "react-hot-toast";
import { formatDate, type PaymentMethod, type Plan } from "@gymos/shared";
import { ActionForm } from "@/components/action-form";
import { Dropdown } from "@/components/dropdown";
import { menuItemClass } from "@/components/menu-styles";
import { Modal } from "@/components/modal";
import { Tooltip } from "@/components/tooltip";
import { useSavedToast } from "@/lib/use-saved-toast";
import { Button, Field, FormError, Input } from "@/components/ui";
import { getMemberSignIn, setMemberActive, setMemberPin, updateMemberDetails, type SignInInfo } from "../actions";

type InfoPromise = Promise<SignInInfo | { error: string }>;
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
  const [pinOpen, setPinOpen] = useState(false);
  const [info, setInfo] = useState<InfoPromise | null>(null);
  const load = () => setInfo(getMemberSignIn(slug, memberId));
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
        <button type="button" role="menuitem" className={menuItemClass} onClick={() => { load(); setEditing(true); }}>
          <Pencil className="size-4 text-muted" /> Edit details
        </button>
        <button type="button" role="menuitem" className={menuItemClass} onClick={() => { load(); setPinOpen(true); }}>
          <KeyRound className="size-4 text-muted" /> Sign-in PIN
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
        {info && <EditDetails info={info} slug={slug} memberId={memberId} fullName={fullName} phone={phone} onSaved={() => setEditing(false)} />}
      </Modal>
      <Modal open={pinOpen} onClose={() => setPinOpen(false)} title="Sign-in PIN">
        {info && (
          <Suspense fallback={<Loading />}>
            <PinPanel info={info} slug={slug} memberId={memberId} fullName={fullName} />
          </Suspense>
        )}
      </Modal>
    </>
  );
}

const Loading = () => <p className="py-6 text-center text-sm text-muted">Loading…</p>;

// Phone + PIN sign-in for members without an email: staff make a PIN and pass
// it on. It's shown only once.
function PinPanel({ info, slug, memberId, fullName }: { info: InfoPromise; slug: string; memberId: string; fullName: string }) {
  const current = use(info);
  const [made, setMade] = useState<{ pin: string; phone: string } | null>(null);
  const [pending, startTransition] = useTransition();
  if ("error" in current) return <FormError message={current.error} />;
  if (current.locked) return <p className="text-sm text-muted">{current.locked}</p>;

  const create = () =>
    startTransition(async () => {
      const result = await setMemberPin(slug, memberId);
      if ("error" in result) toast.error(result.error);
      else setMade(result);
    });

  if (made) {
    const first = fullName.split(" ")[0] || "there";
    const message =
      `Hi ${first}, to sign in to the gym app: open ${window.location.origin}/login, choose "Phone + PIN", ` +
      `then enter your phone number and PIN ${made.pin}. Please don't share your PIN.`;
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted">Give this PIN to {fullName || "the member"}. It won&apos;t be shown again.</p>
        <p className="font-mono text-4xl font-bold tracking-[0.3em]">{made.pin}</p>
        <p className="text-sm text-muted">They sign in with their phone number and this PIN.</p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={() => navigator.clipboard.writeText(made.pin).then(() => toast.success("PIN copied"))}
          >
            <Copy className="size-4" /> Copy PIN
          </Button>
          <a
            href={`https://wa.me/${made.phone}?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2 text-sm font-semibold text-white"
          >
            Send on WhatsApp
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Members without an email can sign in with their phone number and a 6-digit PIN you give them.</p>
      <dl className="space-y-1 rounded-lg bg-border/30 p-3 text-sm">
        <div className="flex justify-between gap-3"><dt className="text-muted">Phone</dt><dd>{current.phone ?? "Not added"}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-muted">Email</dt><dd className="truncate">{current.email ?? "None"}</dd></div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">PIN</dt>
          <dd>{current.pinSetAt ? `Set on ${formatDate(current.pinSetAt.slice(0, 10))}` : "Not set"}</dd>
        </div>
      </dl>
      {current.phone ? (
        <>
          {current.pinSetAt && <p className="text-xs text-muted">A new PIN replaces the old one, and their password if they had one.</p>}
          <Button className="w-full" onClick={create} loading={pending}>
            <KeyRound className="size-4" /> {current.pinSetAt ? "Make a new PIN" : "Make a PIN"}
          </Button>
        </>
      ) : (
        <p className="text-sm text-danger">Add their phone number first (Edit details): they sign in with it.</p>
      )}
    </div>
  );
}

type EditProps = { slug: string; memberId: string; fullName: string; phone: string; onSaved: () => void };

// Waits for the member's current email, loaded when the dialog opens.
function EditDetails({ info, ...props }: EditProps & { info: InfoPromise }) {
  return (
    <Suspense fallback={<Loading />}>
      <EditDetailsLoaded info={info} {...props} />
    </Suspense>
  );
}

function EditDetailsLoaded({ info, ...props }: EditProps & { info: InfoPromise }) {
  const current = use(info);
  if ("error" in current) return <FormError message={current.error} />;
  return <EditDetailsForm {...props} current={current} />;
}

function EditDetailsForm({ slug, memberId, fullName, phone, current, onSaved }: {
  current: SignInInfo;
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
      <Field
        label="Email"
        hint={current.locked ?? "They can sign in to the app with a code sent here. No email? Use Sign-in PIN in the ⋯ menu on their page."}
      >
        <Input name="email" type="email" defaultValue={current.email ?? ""} disabled={!!current.locked} autoComplete="off" placeholder="name@example.com" />
      </Field>
      <p className="text-xs text-muted">This updates the member&apos;s profile, which they also see in the app.</p>
      <FormError message={state?.error} />
      <Button className="w-full" loading={pending}>{pending ? "Saving…" : "Save"}</Button>
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
  const [info, setInfo] = useState<InfoPromise | null>(null);
  return (
    <>
      <Tooltip content="Edit details">
        <button
          type="button"
          onClick={() => {
            setInfo(getMemberSignIn(slug, memberId));
            setOpen(true);
          }}
          aria-label={`Edit ${fullName || "member"}`}
          className="rounded-lg p-2 text-muted hover:bg-border/40 hover:text-foreground"
        >
          <Pencil className="size-4" />
        </button>
      </Tooltip>
      <Modal open={open} onClose={() => setOpen(false)} title="Edit member details">
        {info && <EditDetails info={info} slug={slug} memberId={memberId} fullName={fullName} phone={phone} onSaved={() => setOpen(false)} />}
      </Modal>
    </>
  );
}
