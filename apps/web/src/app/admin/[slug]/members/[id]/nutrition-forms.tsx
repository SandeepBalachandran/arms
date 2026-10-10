"use client";

import { useActionState, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { GOAL_LABELS, suggestTargets, type Activity, type NutritionGoal } from "@gymos/shared";
import { ActionForm } from "@/components/action-form";
import { Button, Field, FormError, Input, Select } from "@/components/ui";
import { useSavedToast } from "@/lib/use-saved-toast";
import { addNutritionComment, saveTargets } from "./nutrition-actions";

type Body = { weightKg: number; heightCm: number; age: number; sex: "male" | "female"; activity: Activity } | null;

// Goal + daily calories and protein. "Suggest" fills them from the member's
// details (Mifflin–St Jeor); the trainer can change anything.
export function TargetForm({ slug, memberId, current, body }: {
  slug: string;
  memberId: string;
  current: { goal: NutritionGoal; kcal: number; protein_g: number } | null;
  body: Body;
}) {
  const [state, action, pending] = useActionState(saveTargets, undefined);
  useSavedToast(state, "Targets saved");
  const [goal, setGoal] = useState<NutritionGoal>(current?.goal ?? "maintain");
  const kcal = useRef<HTMLInputElement>(null);
  const protein = useRef<HTMLInputElement>(null);
  const [hint, setHint] = useState<string>();

  function suggest() {
    if (!body) return;
    const s = suggestTargets({ ...body, goal });
    if (kcal.current) kcal.current.value = String(s.kcal);
    if (protein.current) protein.current.value = String(s.protein_g);
    setHint(`Maintenance ≈ ${s.maintenance} kcal. Suggested ${s.kcal} kcal and ${s.protein_g} g protein for "${GOAL_LABELS[goal]}".`);
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="member_id" value={memberId} />
      <div className="grid grid-cols-3 gap-3">
        <Field label="Goal">
          <Select name="goal" value={goal} onChange={(e) => setGoal(e.target.value as NutritionGoal)}>
            {(Object.keys(GOAL_LABELS) as NutritionGoal[]).map((g) => <option key={g} value={g}>{GOAL_LABELS[g]}</option>)}
          </Select>
        </Field>
        <Field label="Calories / day">
          <Input ref={kcal} name="kcal" type="number" min={800} max={6000} step={10} defaultValue={current?.kcal ?? ""} required />
        </Field>
        <Field label="Protein (g) / day">
          <Input ref={protein} name="protein_g" type="number" min={20} max={400} defaultValue={current?.protein_g ?? ""} required />
        </Field>
      </div>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      <FormError message={state?.error} />
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending}>{pending ? "Saving…" : current ? "Update targets" : "Set targets"}</Button>
        <Button
          type="button"
          variant="secondary"
          onClick={suggest}
          disabled={!body}
          title={body ? undefined : "Needs the member's height, age, sex and a weight entry"}
        >
          <Sparkles className="size-4" /> Suggest
        </Button>
      </div>
      {!body && <p className="text-xs text-muted">Suggest works once the member has added height, age and sex in the app and logged a weight.</p>}
    </form>
  );
}

export function CommentForm({ slug, memberId, days }: { slug: string; memberId: string; days: { value: string; label: string }[] }) {
  return (
    <ActionForm action={addNutritionComment} success="Comment sent" className="space-y-2">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="member_id" value={memberId} />
      <div className="flex gap-2">
        <Select name="day" defaultValue={days[0]?.value} className="w-36 shrink-0">
          {days.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </Select>
        <Input name="body" placeholder="e.g. Good protein today 👍 Swap the porotta for chapati." maxLength={500} required />
        <Button className="shrink-0">Send</Button>
      </div>
    </ActionForm>
  );
}
