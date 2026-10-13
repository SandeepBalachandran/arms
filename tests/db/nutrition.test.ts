import { beforeAll, describe, expect, it } from "vitest";
import { as, fx, memberId, refused, service, setGym } from "./fixture";

const gymId = fx.gym.id;
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const mid = () => memberId("member");

// Nutrition data is health data: only the member, their own PT trainer and
// the owner/admin may see it. Front-desk staff and other members may not.
beforeAll(async () => {
  await setGym({ nutrition_enabled: true, pt_enabled: true });
  // Make the trainer this member's coach with an active PT package.
  const end = new Date(Date.now() + 20 * 86400_000).toISOString().slice(0, 10);
  const sub = await service.from("pt_subscriptions").insert({
    gym_id: gymId, member_id: mid(), trainer_member_id: memberId("trainer"), package_name: "Nutrition test", starts_on: today, ends_on: end, status: "active",
  });
  expect(sub.error?.message).toBeUndefined();
});

describe("member", () => {
  it("sees the built-in food list", async () => {
    const { count } = await as.member.from("foods").select("*", { count: "exact", head: true }).is("gym_id", null);
    expect(count).toBeGreaterThan(100);
  });

  it("logs food, water and their details", async () => {
    expect((await as.member.from("nutrition_profiles").upsert({ member_id: mid(), gym_id: gymId, consent_at: new Date().toISOString(), height_cm: 172, notes: "TEST lactose intolerant" })).error?.message).toBeUndefined();
    expect((await as.member.from("food_logs").insert({ gym_id: gymId, member_id: mid(), logged_on: today, meal: "breakfast", name: "Puttu", kcal: 170, protein_g: 3.5 })).error?.message).toBeUndefined();
    expect((await as.member.from("water_logs").upsert({ member_id: mid(), gym_id: gymId, logged_on: today, ml: 750 })).error?.message).toBeUndefined();
  });

  it("can't log food for someone else", async () => {
    const res = await as.member2.from("food_logs").insert({ gym_id: gymId, member_id: mid(), logged_on: today, meal: "lunch", name: "x", kcal: 1 }).select("id");
    expect(refused(res)).toBe(true);
  });

  it("can't add foods to the gym's list", async () => {
    expect(refused(await as.member.from("foods").insert({ gym_id: gymId, name: "x", serving_label: "1", kcal: 1 }).select("id"))).toBe(true);
  });
});

describe("trainer", () => {
  it("reads their client's food log and health notes", async () => {
    expect((await as.trainer.from("food_logs").select("id").eq("member_id", mid())).data!.length).toBeGreaterThan(0);
    const { data } = await as.trainer.from("nutrition_profiles").select("notes").eq("member_id", mid()).single();
    expect(data!.notes).toMatch(/lactose/);
  });

  it("sets targets and comments, which the member sees", async () => {
    expect((await as.trainer.from("nutrition_targets").upsert({ member_id: mid(), gym_id: gymId, goal: "lose", kcal: 2000, protein_g: 130, set_by: fx.users.trainer.id })).error?.message).toBeUndefined();
    expect((await as.trainer.from("nutrition_comments").insert({ gym_id: gymId, member_id: mid(), author_member_id: memberId("trainer"), day: today, body: "Add an egg" })).error?.message).toBeUndefined();
    expect((await as.member.from("nutrition_targets").select("kcal").eq("member_id", mid()).single()).data!.kcal).toBe(2000);
    expect((await as.member.from("nutrition_comments").select("body").eq("member_id", mid())).data!.map((c) => c.body)).toContain("Add an egg");
  });

  it("can't log meals for the client", async () => {
    const res = await as.trainer.from("food_logs").insert({ gym_id: gymId, member_id: mid(), logged_on: today, meal: "lunch", name: "x", kcal: 1 }).select("id");
    expect(refused(res)).toBe(true);
  });

  it("can't comment as someone else", async () => {
    const res = await as.trainer.from("nutrition_comments").insert({ gym_id: gymId, member_id: mid(), author_member_id: memberId("owner"), day: today, body: "x" }).select("id");
    expect(refused(res)).toBe(true);
  });
});

describe("water", () => {
  it("keeps glasses and ml in step for older app versions", async () => {
    const day = "2001-01-01";
    // An old app writes glasses only; ml follows.
    expect((await as.member.from("water_logs").upsert({ member_id: mid(), gym_id: gymId, logged_on: day, glasses: 3 })).error?.message).toBeUndefined();
    expect((await as.member.from("water_logs").select("ml, glasses").eq("member_id", mid()).eq("logged_on", day).single()).data).toEqual({ ml: 750, glasses: 3 });
    // The new app writes ml; glasses is rounded from it.
    expect((await as.member.from("water_logs").update({ ml: 1600 }).eq("member_id", mid()).eq("logged_on", day)).error?.message).toBeUndefined();
    expect((await as.member.from("water_logs").select("ml, glasses").eq("member_id", mid()).eq("logged_on", day).single()).data).toEqual({ ml: 1600, glasses: 6 });
    await as.member.from("water_logs").delete().eq("member_id", mid()).eq("logged_on", day);
  });

  it("member saves a goal and containers; their coach can read them, others can't", async () => {
    const containers = [{ label: "Steel bottle", ml: 750 }];
    expect((await as.member.from("water_settings").upsert({ member_id: mid(), gym_id: gymId, goal_ml: 3000, containers })).error?.message).toBeUndefined();
    expect((await as.trainer.from("water_settings").select("goal_ml").eq("member_id", mid())).data).toEqual([{ goal_ml: 3000 }]);
    for (const role of ["staff", "member2", "outsider"] as const) {
      expect((await as[role].from("water_settings").select("goal_ml").eq("member_id", mid())).data).toEqual([]);
    }
    expect(refused(await as.member2.from("water_settings").upsert({ member_id: mid(), gym_id: gymId, goal_ml: 500 }).select("member_id"))).toBe(true);
  });

  it("rejects too many containers", async () => {
    const containers = Array.from({ length: 6 }, () => ({ label: "Glass", ml: 250 }));
    expect((await as.member.from("water_settings").upsert({ member_id: mid(), gym_id: gymId, containers })).error).not.toBeNull();
  });
});

describe("everyone else", () => {
  it.each(["staff", "member2", "outsider"] as const)("%s can't see the food log or health notes", async (role) => {
    expect((await as[role].from("food_logs").select("id").eq("member_id", mid())).data).toEqual([]);
    expect((await as[role].from("nutrition_profiles").select("member_id").eq("member_id", mid())).data).toEqual([]);
    expect((await as[role].from("water_logs").select("ml").eq("member_id", mid())).data).toEqual([]);
  });

  it("staff can't comment or set targets", async () => {
    expect(refused(await as.staff.from("nutrition_comments").insert({ gym_id: gymId, member_id: mid(), author_member_id: memberId("staff"), day: today, body: "x" }).select("id"))).toBe(true);
    expect(refused(await as.staff.from("nutrition_targets").upsert({ member_id: mid(), gym_id: gymId, goal: "gain", kcal: 3000, protein_g: 1 }).select("member_id"))).toBe(true);
  });

  it("owner and admin can read it", async () => {
    expect((await as.owner.from("food_logs").select("id").eq("member_id", mid())).data!.length).toBeGreaterThan(0);
    expect((await as.admin.from("water_logs").select("ml").eq("member_id", mid())).data).toHaveLength(1);
  });

  it("a trainer who isn't the member's coach can't see it", async () => {
    // Take the trainer off every PT package this member has, then put it back.
    const { data: subs } = await service.from("pt_subscriptions").select("id, trainer_member_id").eq("member_id", mid());
    await service.from("pt_subscriptions").update({ trainer_member_id: null }).eq("member_id", mid());
    const res = await as.trainer.from("food_logs").select("id").eq("member_id", mid());
    for (const s of subs!) await service.from("pt_subscriptions").update({ trainer_member_id: s.trainer_member_id }).eq("id", s.id);
    expect(res.data).toEqual([]);
  });
});
