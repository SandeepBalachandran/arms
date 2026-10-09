"use client";

import { useActionState, useState } from "react";
import {
  formatDuration,
  formatMoney,
  formatSessions,
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
} from "@gymos/shared";
import { CalendarCheck, Pencil, Plus } from "lucide-react";
import { Modal } from "@/components/modal";
import { useSavedToast } from "@/lib/use-saved-toast";
import { Button, Field, FormError, Input, Select } from "@/components/ui";
import { logSession, savePackage, sellPackage } from "./actions";

export type PtPackage = {
  id: string;
  name: string;
  description: string | null;
  sessions: number | null;
  validity_days: number;
  price_paise: number;
  sort_order: number;
  is_active: boolean;
};

type Option = { id: string; name: string };

const VALIDITY = [
  { label: "1 month", days: 30 },
  { label: "2 months", days: 60 },
  { label: "3 months", days: 90 },
  { label: "6 months", days: 180 },
];

// "New package" / "Edit" button with the package form in a modal.
export function PackageDialog({ slug, currency, pkg }: { slug: string; currency: string; pkg?: PtPackage }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {pkg ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-border/40"
        >
          <Pencil className="size-3.5" /> Edit
        </button>
      ) : (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> New package
        </Button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={pkg ? `Edit ${pkg.name}` : "New PT package"}>
        <PackageForm slug={slug} currency={currency} pkg={pkg} onSaved={() => setOpen(false)} />
      </Modal>
    </>
  );
}

function PackageForm({ slug, currency, pkg, onSaved }: { slug: string; currency: string; pkg?: PtPackage; onSaved: () => void }) {
  const [state, action, pending] = useActionState(savePackage, undefined);
  useSavedToast(state, pkg ? "Package saved" : "Package created", onSaved);
  const [unlimited, setUnlimited] = useState(pkg ? pkg.sessions === null : false);
  const [sessions, setSessions] = useState(String(pkg?.sessions ?? 12));
  const [preset, setPreset] = useState<number | "custom">(
    VALIDITY.find((v) => v.days === pkg?.validity_days)?.days ?? (pkg ? "custom" : 30),
  );
  const [customDays, setCustomDays] = useState(String(pkg?.validity_days ?? 30));
  const [price, setPrice] = useState(pkg ? String(pkg.price_paise / 100) : "");

  const days = preset === "custom" ? Number(customDays) || 0 : preset;
  const paise = Math.round(Number(price.replace(/,/g, "")) * 100) || 0;
  const perSession = !unlimited && paise > 0 && Number(sessions) > 0 ? formatMoney(Math.round(paise / Number(sessions)), currency) : null;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      {pkg && <input type="hidden" name="id" value={pkg.id} />}
      <input type="hidden" name="validity_days" value={days} />
      {unlimited && <input type="hidden" name="sessions" value="" />}

      <Field label="Package name">
        <Input name="name" defaultValue={pkg?.name} placeholder={unlimited ? "Monthly PT" : "12 PT sessions"} required autoFocus />
      </Field>
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Priced as</legend>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: false, label: "Pack of sessions", hint: "e.g. 12 sessions" },
            { value: true, label: "Unlimited for a period", hint: "e.g. monthly PT" },
          ].map((o) => (
            <label
              key={o.label}
              className="cursor-pointer rounded-lg border border-border p-3 text-sm has-checked:border-brand has-checked:bg-brand/10"
            >
              <input type="radio" name="pt_kind" checked={unlimited === o.value} onChange={() => setUnlimited(o.value)} className="sr-only" />
              <span className="block font-medium">{o.label}</span>
              <span className="text-xs text-muted">{o.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Price (${currency})`} hint={perSession ? `≈ ${perSession} per session` : undefined}>
          <Input name="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="6000" required />
        </Field>
        {!unlimited && (
          <Field label="Sessions">
            <Input name="sessions" type="number" min={1} max={500} value={sessions} onChange={(e) => setSessions(e.target.value)} required />
          </Field>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={unlimited ? "Lasts" : "Use within"}>
          <Select value={String(preset)} onChange={(e) => setPreset(e.target.value === "custom" ? "custom" : Number(e.target.value))}>
            {VALIDITY.map((v) => <option key={v.days} value={v.days}>{v.label}</option>)}
            <option value="custom">Custom…</option>
          </Select>
        </Field>
        {preset === "custom" && (
          <Field label="Days">
            <Input type="number" min={1} max={3660} value={customDays} onChange={(e) => setCustomDays(e.target.value)} required />
          </Field>
        )}
      </div>
      <Field label="Description" hint="Shown to members in the app if you show PT there.">
        <Input name="description" defaultValue={pkg?.description ?? ""} placeholder="One-on-one coaching with diet guidance" />
      </Field>
      <Field label="Display order" hint="Lower numbers show first.">
        <Input name="sort_order" type="number" min={0} defaultValue={pkg?.sort_order ?? 0} />
      </Field>
      <FormError message={state?.error} />
      <Button className="w-full" disabled={pending}>{pending ? "Saving…" : pkg ? "Save changes" : "Create package"}</Button>
    </form>
  );
}

type SellProps = {
  slug: string;
  currency: string;
  packages: PtPackage[];
  trainers: Option[];
  methods: PaymentMethod[];
  // Fixed member (member page) or a picker (PT page).
  member?: Option;
  members?: Option[];
  label?: string;
};

export function SellDialog(props: SellProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={props.packages.length === 0} title={props.packages.length === 0 ? "Create a package first" : undefined}>
        <Plus className="size-4" /> {props.label ?? "Sell PT package"}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={props.member ? `Sell PT to ${props.member.name}` : "Sell PT package"}>
        <SellForm {...props} onSaved={() => setOpen(false)} />
      </Modal>
    </>
  );
}

function SellForm({ slug, currency, packages, trainers, methods, member, members, onSaved }: SellProps & { onSaved: () => void }) {
  const [state, action, pending] = useActionState(sellPackage, undefined);
  useSavedToast(state, "PT package sold", onSaved);
  const [packageId, setPackageId] = useState(packages[0]?.id ?? "");
  const pkg = packages.find((p) => p.id === packageId);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      {member ? (
        <input type="hidden" name="member_id" value={member.id} />
      ) : (
        <Field label="Member">
          <Select name="member_id" required defaultValue="">
            <option value="" disabled>Choose a member…</option>
            {members?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </Field>
      )}
      <Field label="Package">
        <Select name="package_id" value={packageId} onChange={(e) => setPackageId(e.target.value)} required>
          {packages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {formatMoney(p.price_paise, currency)} · {formatSessions(p.sessions)} · {formatDuration(p.validity_days)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Trainer">
        <Select name="trainer_member_id" defaultValue={trainers[0]?.id ?? ""}>
          <option value="">Not assigned yet</option>
          {trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Method">
          <Select name="method" defaultValue={methods[0]}>
            {methods.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
          </Select>
        </Field>
        <Field label={`Amount (${currency})`} hint="Change it for a discount.">
          <Input key={pkg?.id} name="amount" inputMode="decimal" defaultValue={pkg ? String(pkg.price_paise / 100) : ""} required />
        </Field>
      </div>
      <Field label="Start date" hint="Leave empty to start today.">
        <Input name="starts_on" type="date" />
      </Field>
      <Field label="Note">
        <Input name="note" placeholder="UPI ref, discount reason…" maxLength={300} />
      </Field>
      <FormError message={state?.error} />
      <Button className="w-full" disabled={pending}>{pending ? "Saving…" : "Record sale"}</Button>
    </form>
  );
}

// "Log session" button with date (default today) and an optional note.
export function LogSessionDialog({ slug, ptSubscriptionId, clientName, today, minDate, compact }: {
  slug: string;
  ptSubscriptionId: string;
  clientName: string;
  today: string;
  minDate: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          compact
            ? "flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-sm font-medium hover:bg-border/40"
            : "flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-brand-fg hover:opacity-90"
        }
      >
        <CalendarCheck className="size-4" /> Log session
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Log a session · ${clientName}`}>
        <LogForm slug={slug} ptSubscriptionId={ptSubscriptionId} today={today} minDate={minDate} onSaved={() => setOpen(false)} />
      </Modal>
    </>
  );
}

function LogForm({ slug, ptSubscriptionId, today, minDate, onSaved }: {
  slug: string;
  ptSubscriptionId: string;
  today: string;
  minDate: string;
  onSaved: () => void;
}) {
  const [state, action, pending] = useActionState(logSession, undefined);
  useSavedToast(state, "Session logged", onSaved);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="pt_subscription_id" value={ptSubscriptionId} />
      <Field label="Date">
        <Input name="session_on" type="date" defaultValue={today} min={minDate} max={today} required />
      </Field>
      <Field label="Note" hint="Optional, e.g. what you worked on.">
        <Input name="notes" maxLength={300} placeholder="Legs + core, increased squat to 60 kg" autoFocus />
      </Field>
      <FormError message={state?.error} />
      <Button className="w-full" disabled={pending}>{pending ? "Saving…" : "Log session"}</Button>
    </form>
  );
}
