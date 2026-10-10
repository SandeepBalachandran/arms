"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { FOOD_TYPE_LABELS, type FoodType } from "@gymos/shared";
import { Modal } from "@/components/modal";
import { Button, Field, FormError, Input, Select } from "@/components/ui";
import { useSavedToast } from "@/lib/use-saved-toast";
import { addFood } from "./actions";

export function AddFood({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Add food
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add a food">
        <FoodForm slug={slug} onSaved={() => setOpen(false)} />
      </Modal>
    </>
  );
}

function FoodForm({ slug, onSaved }: { slug: string; onSaved: () => void }) {
  const [state, action, pending] = useActionState(addFood, undefined);
  useSavedToast(state, "Food added", onSaved);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="category" value="gym" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name"><Input name="name" placeholder="Chicken salad bowl" required /></Field>
        <Field label="Malayalam name (optional)"><Input name="name_ml" placeholder="ചിക്കൻ സാലഡ്" /></Field>
        <Field label="Portion" hint="What one serving is"><Input name="serving_label" placeholder="1 bowl" required /></Field>
        <Field label="Type">
          <Select name="food_type" defaultValue="veg">
            {(Object.keys(FOOD_TYPE_LABELS) as FoodType[]).map((t) => <option key={t} value={t}>{FOOD_TYPE_LABELS[t]}</option>)}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <Field label="Calories"><Input name="kcal" type="number" min={0} max={3000} required /></Field>
        <Field label="Protein g"><Input name="protein_g" type="number" min={0} step="0.1" defaultValue={0} /></Field>
        <Field label="Carbs g"><Input name="carbs_g" type="number" min={0} step="0.1" defaultValue={0} /></Field>
        <Field label="Fat g"><Input name="fat_g" type="number" min={0} step="0.1" defaultValue={0} /></Field>
      </div>
      <FormError message={state?.error} />
      <Button className="w-full" disabled={pending}>{pending ? "Adding…" : "Add food"}</Button>
    </form>
  );
}
