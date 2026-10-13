import { beforeAll, describe, expect, it } from "vitest";
import { as, fx, memberId, refused, service, setGym } from "./fixture";

const gymId = fx.gym.id;
let planId: string;
let exerciseId: string;
let logId: string;

beforeAll(async () => {
  await setGym({ workouts_enabled: true });
  const { data: ex } = await as.member.from("exercises").select("id").is("gym_id", null).eq("name", "Bench Press").single();
  exerciseId = ex!.id;
  const plan = await as.trainer.from("workout_plans").insert({ gym_id: gymId, name: "Test PPL", created_by: memberId("trainer") }).select("id").single();
  expect(plan.error?.message).toBeUndefined();
  planId = plan.data!.id;
  const items = await as.trainer.from("workout_plan_items").insert({ plan_id: planId, day_label: "Day 1", exercise_id: exerciseId, sets: 3, reps: "8-10" });
  expect(items.error?.message).toBeUndefined();
});

describe("plans", () => {
  it("members can't create plans", async () => {
    expect(refused(await as.member.from("workout_plans").insert({ gym_id: gymId, name: "Mine" }).select("id"))).toBe(true);
  });

  it("a member only sees a plan once it's assigned to them", async () => {
    expect((await as.member.from("workout_plans").select("id").eq("id", planId)).data).toEqual([]);
    const assign = await as.trainer.from("plan_assignments").insert({ gym_id: gymId, member_id: memberId("member"), plan_id: planId, assigned_by: memberId("trainer") });
    expect(assign.error?.message).toBeUndefined();
    expect((await as.member.from("workout_plans").select("id").eq("id", planId)).data).toHaveLength(1);
    expect((await as.member.from("workout_plan_items").select("id").eq("plan_id", planId)).data).toHaveLength(1);
    expect((await as.member2.from("workout_plans").select("id").eq("id", planId)).data).toEqual([]);
  });

  it("members can't assign plans to themselves", async () => {
    const res = await as.member2.from("plan_assignments").insert({ gym_id: gymId, member_id: memberId("member2"), plan_id: planId }).select("id");
    expect(refused(res)).toBe(true);
  });
});

describe("logging workouts", () => {
  it("a member logs a workout with sets", async () => {
    const log = await as.member.from("workout_logs").insert({ gym_id: gymId, member_id: memberId("member"), plan_id: planId, day_label: "Day 1", duration_min: 45 }).select("id").single();
    expect(log.error?.message).toBeUndefined();
    logId = log.data!.id;
    const sets = await as.member.from("workout_log_sets").insert([
      { log_id: logId, exercise_id: exerciseId, set_no: 1, reps: 10, weight_kg: 60 },
      { log_id: logId, exercise_id: exerciseId, set_no: 2, reps: 8, weight_kg: 65 },
    ]);
    expect(sets.error?.message).toBeUndefined();
  });

  it("can't log a workout as someone else", async () => {
    const res = await as.member2.from("workout_logs").insert({ gym_id: gymId, member_id: memberId("member") }).select("id");
    expect(refused(res)).toBe(true);
  });

  it("can't add sets to someone else's workout", async () => {
    const res = await as.member2.from("workout_log_sets").insert({ log_id: logId, exercise_id: exerciseId, set_no: 3, reps: 1 }).select("id");
    expect(refused(res)).toBe(true);
  });

  it("other members can't see your workouts; trainers can", async () => {
    expect((await as.member2.from("workout_logs").select("id").eq("id", logId)).data).toEqual([]);
    expect((await as.member2.from("workout_log_sets").select("id").eq("log_id", logId)).data).toEqual([]);
    expect((await as.trainer.from("workout_log_sets").select("id").eq("log_id", logId)).data).toHaveLength(2);
  });

  it("trainers can't change a member's logged sets", async () => {
    const res = await as.trainer.from("workout_log_sets").update({ weight_kg: 999 }).eq("log_id", logId).select("id");
    expect(refused(res)).toBe(true);
  });

  it("body weight is private to the member and the team", async () => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
    expect((await as.member.from("body_metrics").upsert({ gym_id: gymId, member_id: memberId("member"), measured_on: today, weight_kg: 74 }, { onConflict: "member_id,measured_on" })).error?.message).toBeUndefined();
    expect((await as.member2.from("body_metrics").select("id").eq("member_id", memberId("member"))).data).toEqual([]);
    expect((await as.trainer.from("body_metrics").select("id").eq("member_id", memberId("member"))).data).toHaveLength(1);
    expect((await as.outsider.from("body_metrics").select("id").eq("member_id", memberId("member"))).data).toEqual([]);
  });
});

it("cleans up", async () => {
  await service.from("workout_plans").delete().eq("id", planId);
});

describe("exercise guides", () => {
  const guide = () => ({ gym_id: gymId, exercise_id: exerciseId, video_url: "https://youtu.be/dQw4w9WgXcQ", how_to_en: "TEST Keep your back flat.", how_to_ml: "TEST പുറം നേരെ വയ്ക്കുക." });

  it("the team writes a guide; members read it but can't change it", async () => {
    expect((await as.trainer.from("exercise_media").upsert(guide())).error?.message).toBeUndefined();
    expect((await as.member.from("exercise_media").select("how_to_ml").eq("gym_id", gymId).eq("exercise_id", exerciseId).single()).data).toEqual({ how_to_ml: "TEST പുറം നേരെ വയ്ക്കുക." });
    expect((await as.member.from("exercise_media").update({ how_to_en: "x" }).eq("gym_id", gymId).eq("exercise_id", exerciseId).select("gym_id")).data ?? []).toEqual([]);
    expect(refused(await as.member2.from("exercise_media").upsert({ ...guide(), how_to_en: "x" }).select("gym_id"))).toBe(true);
  });

  it("people outside the gym can't read it", async () => {
    expect((await as.outsider.from("exercise_media").select("gym_id").eq("gym_id", gymId)).data).toEqual([]);
  });

  it("only takes https video links and short text", async () => {
    expect((await as.staff.from("exercise_media").upsert({ ...guide(), video_url: "http://example.com/v" })).error).not.toBeNull();
    expect((await as.staff.from("exercise_media").upsert({ ...guide(), how_to_en: "x".repeat(1001) })).error).not.toBeNull();
    expect((await as.staff.from("exercise_media").upsert({ ...guide(), photo_urls: ["a", "b", "c", "d"] })).error).not.toBeNull();
  });

  it("can't attach a guide to another gym's own exercise", async () => {
    const other = await service.from("gyms").insert({ name: "TEST other gym", slug: `test-other-${Date.now()}` }).select("id").single();
    const ex = await service.from("exercises").insert({ gym_id: other.data!.id, name: "TEST secret move", muscle_group: "Core" }).select("id").single();
    const res = await as.owner.from("exercise_media").upsert({ gym_id: gymId, exercise_id: ex.data!.id, how_to_en: "x" }).select("gym_id");
    await service.from("gyms").delete().eq("id", other.data!.id);
    expect(refused(res)).toBe(true);
  });

  it("a member picks the language guides are shown in", async () => {
    const { data: me } = await as.member.auth.getUser();
    expect((await as.member.from("profiles").update({ language: "ml" }).eq("id", me.user!.id)).error?.message).toBeUndefined();
    expect((await as.member.from("profiles").update({ language: "fr" }).eq("id", me.user!.id)).error).not.toBeNull();
    await as.member.from("profiles").update({ language: "en" }).eq("id", me.user!.id);
    await service.from("exercise_media").delete().eq("gym_id", gymId).eq("exercise_id", exerciseId);
  });
});
