"use client";

import { useActionState, useState } from "react";
import { formatDay, WEEKDAYS } from "@gymos/shared";
import { CalendarPlus, Pencil, Plus } from "lucide-react";
import { Modal } from "@/components/modal";
import { useSavedToast } from "@/lib/use-saved-toast";
import { Button, Field, FormError, Input, Select } from "@/components/ui";
import { createClassType, createSeries, updateClassType } from "./actions";

export type ClassType = {
  id: string;
  name: string;
  description: string | null;
  default_capacity: number;
  default_duration_min: number;
};

// "New class type" / "Edit" button with the class type form in a modal.
export function ClassTypeDialog({ slug, type, primary }: { slug: string; type?: ClassType; primary?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {type ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-border/40"
        >
          <Pencil className="size-3.5" /> Edit
        </button>
      ) : (
        <Button variant={primary ? "primary" : "secondary"} onClick={() => setOpen(true)}>
          <Plus className="size-4" /> New class type
        </Button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={type ? `Edit ${type.name}` : "New class type"}>
        <ClassTypeForm slug={slug} type={type} onSaved={() => setOpen(false)} />
      </Modal>
    </>
  );
}

function ClassTypeForm({ slug, type, onSaved }: { slug: string; type?: ClassType; onSaved: () => void }) {
  const [state, action, pending] = useActionState(type ? updateClassType : createClassType, undefined);
  useSavedToast(state, type ? "Class type saved" : "Class type added", onSaved);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      {type && <input type="hidden" name="id" value={type.id} />}
      <Field label="Name">
        <Input name="name" defaultValue={type?.name} placeholder="Zumba" required autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Spots per class">
          <Input name="default_capacity" type="number" min={1} max={500} defaultValue={type?.default_capacity ?? 20} required />
        </Field>
        <Field label="Length (minutes)">
          <Input name="default_duration_min" type="number" min={5} max={480} defaultValue={type?.default_duration_min ?? 60} required />
        </Field>
      </div>
      <Field label="Description" hint="Shown to members when they book.">
        <Input name="description" defaultValue={type?.description ?? ""} placeholder="High-energy dance workout" />
      </Field>
      {type && <p className="text-xs text-muted">Changes apply to classes you schedule from now on.</p>}
      <FormError message={state?.error} />
      <Button className="w-full" disabled={pending}>{pending ? "Saving…" : type ? "Save changes" : "Add class type"}</Button>
    </form>
  );
}

type SeriesProps = {
  slug: string;
  types: ClassType[];
  trainers: { id: string; name: string }[];
  defaultStart: string;
  today: string;
};

// "Schedule classes" button with the weekly series form in a modal.
export function ScheduleDialog(props: SeriesProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <CalendarPlus className="size-4" /> Schedule classes
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Schedule classes">
        <SeriesForm {...props} onSaved={() => setOpen(false)} />
      </Modal>
    </>
  );
}

// Monday first, as gyms plan their week; values stay 0 = Sunday … 6 = Saturday.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

function SeriesForm({ slug, types, trainers, defaultStart, today, onSaved }: SeriesProps & { onSaved: () => void }) {
  const [state, action, pending] = useActionState(createSeries, undefined);
  useSavedToast(state, "Classes scheduled", onSaved);
  const [typeId, setTypeId] = useState(types[0]?.id ?? "");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [time, setTime] = useState("07:00");
  const [weeks, setWeeks] = useState("4");
  const [start, setStart] = useState(defaultStart);
  const type = types.find((t) => t.id === typeId);

  const count = weekdays.length * (Number(weeks) || 0);
  const dayNames = WEEK_ORDER.filter((d) => weekdays.includes(d)).map((d) => WEEKDAYS[d]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <Field label="Class">
        <Select name="class_type_id" value={typeId} onChange={(e) => setTypeId(e.target.value)} required>
          {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
      </Field>
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Repeats on</legend>
        <div className="flex flex-wrap gap-1.5">
          {WEEK_ORDER.map((i) => (
            <label
              key={i}
              className="flex min-w-11 cursor-pointer items-center justify-center rounded-lg border border-border px-2 py-1.5 text-sm has-checked:border-brand has-checked:bg-brand has-checked:text-brand-fg has-focus-visible:ring-2 has-focus-visible:ring-brand"
            >
              <input
                type="checkbox"
                name="weekdays"
                value={i}
                checked={weekdays.includes(i)}
                onChange={(e) => setWeekdays((w) => (e.target.checked ? [...w, i] : w.filter((d) => d !== i)))}
                className="sr-only"
              />
              {WEEKDAYS[i]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Time">
          <Input name="local_time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </Field>
        <Field label="Starting">
          <Input name="start_date" type="date" min={today} value={start} onChange={(e) => setStart(e.target.value)} required />
        </Field>
        <Field label="For (weeks)">
          <Input name="weeks" type="number" min={1} max={26} value={weeks} onChange={(e) => setWeeks(e.target.value)} required />
        </Field>
      </div>
      <Field label="Trainer">
        <Select name="trainer_member_id" defaultValue="">
          <option value="">No trainer</option>
          {trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Spots">
          <Input name="capacity" type="number" min={1} placeholder={String(type?.default_capacity ?? "")} />
        </Field>
        <Field label="Minutes">
          <Input name="duration_min" type="number" min={5} placeholder={String(type?.default_duration_min ?? "")} />
        </Field>
        <Field label="Room">
          <Input name="room" placeholder="Studio" />
        </Field>
      </div>
      <p className="rounded-lg bg-border/40 px-3 py-2 text-sm" aria-live="polite">
        {count > 0 && type ? (
          <>
            Adds <strong>{count} {count === 1 ? "class" : "classes"}</strong>: {type.name} every {dayNames.join(", ")} at{" "}
            {formatClock(time)}, from {start ? formatDay(start) : "—"} for {weeks} {weeks === "1" ? "week" : "weeks"}.
          </>
        ) : (
          <span className="text-muted">Pick the days this class repeats on.</span>
        )}
      </p>
      <FormError message={state?.error} />
      <Button className="w-full" disabled={pending || count === 0}>
        {pending ? "Scheduling…" : count > 0 ? `Schedule ${count} ${count === 1 ? "class" : "classes"}` : "Schedule classes"}
      </Button>
    </form>
  );
}

// "07:00" → "7:00 am"
function formatClock(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return hhmm;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}
