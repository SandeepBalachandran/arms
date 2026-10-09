"use client";

import { useActionState } from "react";
import { Button, Field, FormError, Input, Select } from "@/components/ui";
import { addPlanItem, createExercise, createPlan } from "./actions";

export function NewPlanForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(createPlan, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <Field label="Plan name">
        <Input name="name" placeholder="Beginner full body" required />
      </Field>
      <Field label="Description">
        <Input name="description" placeholder="3 days a week, 45 minutes" />
      </Field>
      <FormError message={state?.error} />
      <Button className="w-full" disabled={pending}>{pending ? "Creating…" : "Create plan"}</Button>
    </form>
  );
}

export function NewExerciseForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(createExercise, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <Field label="Exercise">
        <Input name="name" placeholder="Smith machine squat" required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Muscle group">
          <Input name="muscle_group" placeholder="Legs" required />
        </Field>
        <Field label="Logged as">
          <Select name="measure" defaultValue="weight_reps">
            <option value="weight_reps">Weight × reps</option>
            <option value="reps">Reps only</option>
            <option value="time">Time</option>
          </Select>
        </Field>
      </div>
      <FormError message={state?.error} />
      {state?.message && <p className="text-sm text-muted">{state.message}</p>}
      <Button variant="secondary" disabled={pending}>{pending ? "Adding…" : "Add exercise"}</Button>
    </form>
  );
}

export function AddItemForm({
  slug,
  planId,
  days,
  exercises,
}: {
  slug: string;
  planId: string;
  days: string[];
  exercises: { id: string; name: string; muscle_group: string }[];
}) {
  const [state, action, pending] = useActionState(addPlanItem, undefined);
  const groups = Map.groupBy(exercises, (e) => e.muscle_group);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="plan_id" value={planId} />
      <Field label="Day" hint="Use the same label to add to an existing day.">
        <Input name="day_label" list="plan-days" defaultValue={days.at(-1) ?? "Day A"} required />
        <datalist id="plan-days">
          {days.map((d) => <option key={d} value={d} />)}
        </datalist>
      </Field>
      <Field label="Exercise">
        <Select name="exercise_id" required>
          {[...groups].map(([group, list]) => (
            <optgroup key={group} label={group}>
              {list.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </optgroup>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Sets">
          <Input name="sets" type="number" min={1} max={20} defaultValue={3} required />
        </Field>
        <Field label="Reps">
          <Input name="reps" defaultValue="8-12" required />
        </Field>
        <Field label="Rest (s)">
          <Input name="rest_sec" type="number" min={0} max={900} defaultValue={90} />
        </Field>
      </div>
      <Field label="Notes">
        <Input name="notes" placeholder="Slow on the way down" />
      </Field>
      <FormError message={state?.error} />
      <Button className="w-full" disabled={pending}>{pending ? "Adding…" : "Add to plan"}</Button>
    </form>
  );
}
