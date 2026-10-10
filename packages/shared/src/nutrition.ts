import type { Database } from "./database.types";

// Nutrition coaching: meals, goals, suggested targets and daily totals.

export type MealSlot = Database["public"]["Enums"]["meal_slot"];
export type NutritionGoal = Database["public"]["Enums"]["nutrition_goal"];
export type FoodType = Database["public"]["Enums"]["food_type"];
export type FoodLog = Database["public"]["Tables"]["food_logs"]["Row"];
export type Food = Database["public"]["Tables"]["foods"]["Row"];

export const MEALS: MealSlot[] = ["early", "breakfast", "lunch", "snack", "dinner"];
export const MEAL_LABELS: Record<MealSlot, string> = {
  early: "Early morning",
  breakfast: "Breakfast",
  lunch: "Lunch",
  snack: "Evening snack",
  dinner: "Dinner",
};
export const GOAL_LABELS: Record<NutritionGoal, string> = { lose: "Lose fat", maintain: "Maintain", gain: "Gain muscle" };
export const FOOD_TYPE_LABELS: Record<FoodType, string> = { veg: "Veg", egg: "Egg", nonveg: "Non-veg" };
export const ACTIVITY_LABELS = { light: "Light (1–2 workouts a week)", moderate: "Moderate (3–4 a week)", active: "Active (5+ a week)" } as const;
export type Activity = keyof typeof ACTIVITY_LABELS;

const ACTIVITY_FACTOR: Record<Activity, number> = { light: 1.375, moderate: 1.55, active: 1.725 };
const GOAL_KCAL: Record<NutritionGoal, number> = { lose: -400, maintain: 0, gain: 300 };
const PROTEIN_PER_KG: Record<NutritionGoal, number> = { lose: 2, maintain: 1.6, gain: 1.8 };

// Mifflin–St Jeor BMR × activity, adjusted for the goal; protein per kg body
// weight. A starting point the trainer can change.
export function suggestTargets(input: {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: "male" | "female";
  activity: Activity;
  goal: NutritionGoal;
}) {
  const bmr = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + (input.sex === "male" ? 5 : -161);
  const maintenance = bmr * ACTIVITY_FACTOR[input.activity];
  const floor = input.sex === "male" ? 1500 : 1200; // never suggest below this
  return {
    maintenance: Math.round(maintenance / 10) * 10,
    kcal: Math.max(floor, Math.round((maintenance + GOAL_KCAL[input.goal]) / 10) * 10),
    protein_g: Math.round(input.weightKg * PROTEIN_PER_KG[input.goal]),
  };
}

export function dayTotals(logs: (Pick<FoodLog, "kcal" | "protein_g"> & Partial<Pick<FoodLog, "carbs_g" | "fat_g">>)[]) {
  return logs.reduce<{ kcal: number; protein_g: number; carbs_g: number; fat_g: number }>(
    (t, l) => ({
      kcal: t.kcal + l.kcal,
      protein_g: t.protein_g + Number(l.protein_g),
      carbs_g: t.carbs_g + Number(l.carbs_g ?? 0),
      fat_g: t.fat_g + Number(l.fat_g ?? 0),
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
}

// "+250 kcal over" / "320 kcal left" style status against the target.
export function calorieBalance(eaten: number, target: number) {
  const diff = eaten - target;
  return { diff, over: diff > 0, label: diff > 0 ? `${diff} kcal over` : `${-diff} kcal left` };
}

// A day counts as on target within ±10% of the calorie target.
export function onTarget(eaten: number, target: number) {
  return eaten > 0 && Math.abs(eaten - target) <= target * 0.1;
}

// Nutrition is shown to a member when the gym has it on and they have a PT
// package running, or the gym opened it to everyone.
export function nutritionAvailable(
  gym: { nutrition_enabled?: boolean | null; nutrition_all_members?: boolean | null } | null | undefined,
  hasActivePt: boolean,
) {
  return !!gym?.nutrition_enabled && (hasActivePt || !!gym.nutrition_all_members);
}

export function ageFrom(birthYear: number | null | undefined, today = new Date()) {
  return birthYear ? today.getFullYear() - birthYear : null;
}
