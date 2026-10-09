import { groupBy } from "./collections";
import type { Database } from "./database.types";

type Tables = Database["public"]["Tables"];
export type Exercise = Tables["exercises"]["Row"];
export type ExerciseMeasure = Database["public"]["Enums"]["exercise_measure"];
export type WorkoutPlanItem = Tables["workout_plan_items"]["Row"];
export type BodyMetric = Tables["body_metrics"]["Row"];

// Plan items grouped by day label, keeping each day's order.
export function groupPlanDays<T extends Pick<WorkoutPlanItem, "day_label" | "position">>(items: T[]) {
  const days = groupBy(
    [...items].sort((a, b) => a.position - b.position),
    (i) => i.day_label,
  );
  return [...days].map(([label, dayItems]) => ({ label, items: dayItems }));
}

// Postgres numeric columns can arrive as strings; normalise to numbers.
export function num(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function formatSet(
  s: { reps: number | null; weight_kg: number | string | null; duration_sec: number | null },
  measure: ExerciseMeasure,
) {
  if (measure === "time") {
    const sec = s.duration_sec ?? 0;
    return sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")} min` : `${sec} s`;
  }
  const weight = num(s.weight_kg);
  if (measure === "reps" || !weight) return `${s.reps ?? 0} reps`;
  return `${weight} kg × ${s.reps ?? 0}`;
}

// Epley one-rep-max estimate, used to rank personal records.
export function estimatedOneRepMax(weightKg: number, reps: number) {
  return reps <= 1 ? weightKg : weightKg * (1 + reps / 30);
}
