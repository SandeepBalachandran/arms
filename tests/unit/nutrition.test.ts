import { describe, expect, it } from "vitest";
import { ageFrom, calorieBalance, dayTotals, nutritionAvailable, onTarget, suggestTargets } from "@gymos/shared";

describe("suggestTargets", () => {
  const man = { weightKg: 78, heightCm: 172, age: 32, sex: "male" as const, activity: "moderate" as const };

  it("maintenance for a 78 kg, 172 cm, 32-year-old man training 3–4 times a week", () => {
    expect(suggestTargets({ ...man, goal: "maintain" })).toEqual({ maintenance: 2640, kcal: 2640, protein_g: 125 });
  });

  it("fat loss is 400 kcal under maintenance, with more protein", () => {
    expect(suggestTargets({ ...man, goal: "lose" })).toMatchObject({ kcal: 2240, protein_g: 156 });
  });

  it("muscle gain is 300 kcal over", () => {
    expect(suggestTargets({ ...man, goal: "gain" }).kcal).toBe(2940);
  });

  it("never suggests below a safe floor", () => {
    const small = { weightKg: 42, heightCm: 148, age: 60, sex: "female" as const, activity: "light" as const, goal: "lose" as const };
    expect(suggestTargets(small).kcal).toBe(1200);
  });
});

describe("daily totals", () => {
  it("adds up a day, with numbers that come back from the database as strings", () => {
    const logs = [
      { kcal: 255, protein_g: "5.3" as unknown as number, carbs_g: 50, fat_g: 1 },
      { kcal: 320, protein_g: 12 },
    ];
    expect(dayTotals(logs)).toEqual({ kcal: 575, protein_g: 17.3, carbs_g: 50, fat_g: 1 });
  });

  it("describes the balance", () => {
    expect(calorieBalance(1800, 2000).label).toBe("200 kcal left");
    expect(calorieBalance(2250, 2000)).toMatchObject({ over: true, label: "250 kcal over" });
  });

  it("on target means within 10%, and an empty day never counts", () => {
    expect([onTarget(1800, 2000), onTarget(2200, 2000), onTarget(1790, 2000), onTarget(0, 2000)]).toEqual([true, true, false, false]);
  });
});

describe("who gets nutrition", () => {
  it.each([
    [{ nutrition_enabled: false }, true, false],
    [{ nutrition_enabled: true }, true, true],
    [{ nutrition_enabled: true }, false, false],
    [{ nutrition_enabled: true, nutrition_all_members: true }, false, true],
    [null, true, false],
  ])("%j, has PT %s → %s", (gym, hasPt, shown) => {
    expect(nutritionAvailable(gym, hasPt)).toBe(shown);
  });

  it("works out age from birth year", () => {
    expect(ageFrom(1994, new Date("2026-10-12"))).toBe(32);
    expect(ageFrom(null)).toBeNull();
  });
});
