"use client";

import { useActionState } from "react";
import { WEEKDAYS } from "@gymos/shared";
import { useSavedToast } from "@/lib/use-saved-toast";
import { Button, Field, FormError, Input, Select } from "@/components/ui";
import { createClassType, createSeries } from "./actions";

export function ClassTypeForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(createClassType, undefined);
  useSavedToast(state, "Class type added");
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <Field label="Name">
        <Input name="name" placeholder="Zumba" required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Capacity">
          <Input name="default_capacity" type="number" min={1} defaultValue={20} required />
        </Field>
        <Field label="Minutes">
          <Input name="default_duration_min" type="number" min={5} defaultValue={60} required />
        </Field>
      </div>
      <Field label="Description">
        <Input name="description" placeholder="High-energy dance workout" />
      </Field>
      <FormError message={state?.error} />
      <Button variant="secondary" disabled={pending}>{pending ? "Adding…" : "Add class type"}</Button>
    </form>
  );
}

export function SeriesForm({
  slug,
  types,
  trainers,
  defaultStart,
}: {
  slug: string;
  types: { id: string; name: string }[];
  trainers: { id: string; name: string }[];
  defaultStart: string;
}) {
  const [state, action, pending] = useActionState(createSeries, undefined);
  useSavedToast(state, "Classes scheduled");
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <Field label="Class">
        <Select name="class_type_id" required>
          {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
      </Field>
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Days</legend>
        <div className="flex flex-wrap gap-1">
          {WEEKDAYS.map((day, i) => (
            <label key={day} className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-sm has-checked:border-brand has-checked:bg-brand/15">
              <input type="checkbox" name="weekdays" value={i} className="sr-only" />
              {day}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Time">
          <Input name="local_time" type="time" defaultValue="07:00" required />
        </Field>
        <Field label="Weeks">
          <Input name="weeks" type="number" min={1} max={26} defaultValue={4} required />
        </Field>
      </div>
      <Field label="Starting">
        <Input name="start_date" type="date" defaultValue={defaultStart} required />
      </Field>
      <Field label="Trainer">
        <Select name="trainer_member_id" defaultValue="">
          <option value="">No trainer</option>
          {trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Capacity">
          <Input name="capacity" type="number" min={1} placeholder="Default" />
        </Field>
        <Field label="Minutes">
          <Input name="duration_min" type="number" min={5} placeholder="Default" />
        </Field>
        <Field label="Room">
          <Input name="room" placeholder="Studio" />
        </Field>
      </div>
      <FormError message={state?.error} />
      <Button className="w-full" disabled={pending}>{pending ? "Scheduling…" : "Schedule classes"}</Button>
    </form>
  );
}
