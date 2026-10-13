"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useActionState, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { useSavedToast } from "@/lib/use-saved-toast";
import { Button, Field, FormError, Input, Select } from "@/components/ui";
import { addPlanItem, createExercise, createPlan, movePlanItem, removePlanItem, updatePlanItem } from "./actions";

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
  useSavedToast(state, "Exercise added");
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
      <Button variant="secondary" disabled={pending}>{pending ? "Adding…" : "Add exercise"}</Button>
    </form>
  );
}

type PlanItem = { id: string; sets: number; reps: string; rest_sec: number | null; notes: string | null; exercises: { name: string } };

// One exercise in a plan day: a summary line with move/edit/remove, and an
// inline form for sets, reps, rest and notes while editing.
export function PlanItemRow({
  slug,
  planId,
  item,
  index,
  isFirst,
  isLast,
}: {
  slug: string;
  planId: string;
  item: PlanItem;
  index: number;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(updatePlanItem, undefined);
  useSavedToast(state, "Exercise updated", () => setEditing(false));

  const hidden = (
    <>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="plan_id" value={planId} />
      <input type="hidden" name="id" value={item.id} />
    </>
  );
  const moveButton = (dir: "up" | "down", disabled: boolean) => (
    <ActionForm action={movePlanItem}>
      {hidden}
      <input type="hidden" name="dir" value={dir} />
      <button
        disabled={disabled}
        aria-label={`Move ${item.exercises.name} ${dir}`}
        className="rounded p-1 text-muted hover:bg-border/40 hover:text-foreground disabled:pointer-events-none disabled:opacity-30">
        {dir === "up" ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </button>
    </ActionForm>
  );

  return (
    <li className="p-3">
      <div className="flex items-center gap-2">
        <div className="flex flex-col">
          {moveButton("up", isFirst)}
          {moveButton("down", isLast)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{index + 1}. {item.exercises.name}</p>
          {!editing && (
            <p className="text-muted">
              {item.sets} × {item.reps}
              {item.rest_sec != null && ` · rest ${item.rest_sec}s`}
              {item.notes && ` · ${item.notes}`}
            </p>
          )}
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-muted hover:text-foreground">
            Edit
          </button>
        )}
        <ActionForm action={removePlanItem} success="Exercise removed" confirm={`Remove ${item.exercises.name} from this plan?`}>
          {hidden}
          <button className="text-xs text-muted hover:text-danger">Remove</button>
        </ActionForm>
      </div>

      {editing && (
        <form action={action} className="mt-3 space-y-3 pl-8">
          {hidden}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Sets">
              <Input name="sets" type="number" min={1} max={20} defaultValue={item.sets} required autoFocus />
            </Field>
            <Field label="Reps">
              <Input name="reps" defaultValue={item.reps} required />
            </Field>
            <Field label="Rest (s)">
              <Input name="rest_sec" type="number" min={0} max={900} defaultValue={item.rest_sec ?? ""} />
            </Field>
          </div>
          <Field label="Notes">
            <Input name="notes" defaultValue={item.notes ?? ""} placeholder="Slow on the way down" />
          </Field>
          <FormError message={state?.error} />
          <div className="flex gap-2">
            <Button disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </form>
      )}
    </li>
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
  useSavedToast(state, "Added to plan");
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
