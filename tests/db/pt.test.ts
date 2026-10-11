import { beforeAll, describe, expect, it } from "vitest";
import { as, fx, memberId, refused, service, setGym } from "./fixture";

const gymId = fx.gym.id;
let packageId: string;
let ptSubId: string;

beforeAll(async () => {
  await setGym({ pt_enabled: true, pt_show_in_app: true, manual_payment_methods: ["cash", "upi", "card", "bank_transfer"] });
  const pkg = await as.owner.from("pt_packages").insert({ gym_id: gymId, name: "4 sessions", price_paise: 400000, sessions: 2, validity_days: 30 }).select("id").single();
  expect(pkg.error?.message).toBeUndefined();
  packageId = pkg.data!.id;
});

describe("PT packages", () => {
  it("only owner/admin create packages", async () => {
    const row = { gym_id: gymId, name: "Nope", price_paise: 1, validity_days: 1 };
    expect(refused(await as.staff.from("pt_packages").insert(row).select("id"))).toBe(true);
    expect(refused(await as.trainer.from("pt_packages").insert(row).select("id"))).toBe(true);
  });

  it("staff sell a package with a trainer", async () => {
    const { data, error } = await as.staff.rpc("sell_pt_package", {
      p_member_id: memberId("member"), p_package_id: packageId, p_trainer_member_id: memberId("trainer"), p_method: "cash",
    });
    expect(error?.message).toBeUndefined();
    ptSubId = data!;
  });

  it("members and trainers can't sell packages", async () => {
    for (const role of ["member", "trainer"] as const) {
      const { error } = await as[role].rpc("sell_pt_package", { p_member_id: memberId("member2"), p_package_id: packageId, p_trainer_member_id: memberId("trainer"), p_method: "cash" });
      expect(error?.message).toMatch(/Not allowed/);
    }
  });

  it("a regular member can't be named as the trainer", async () => {
    const { error } = await as.staff.rpc("sell_pt_package", { p_member_id: memberId("member2"), p_package_id: packageId, p_trainer_member_id: memberId("member"), p_method: "cash" });
    expect(error?.message).toMatch(/Trainer not found/);
  });

  it("can't sell when PT is switched off", async () => {
    await setGym({ pt_enabled: false });
    const { error } = await as.staff.rpc("sell_pt_package", { p_member_id: memberId("member2"), p_package_id: packageId, p_trainer_member_id: memberId("trainer"), p_method: "cash" });
    await setGym({ pt_enabled: true });
    expect(error?.message).toMatch(/turned off/);
  });
});

describe("PT sessions", () => {
  it("the client's trainer logs sessions until the package runs out", async () => {
    expect((await as.trainer.rpc("log_pt_session", { p_pt_subscription_id: ptSubId, p_notes: "Legs" })).error?.message).toBeUndefined();
    expect((await as.trainer.rpc("log_pt_session", { p_pt_subscription_id: ptSubId })).error?.message).toBeUndefined();
    const third = await as.trainer.rpc("log_pt_session", { p_pt_subscription_id: ptSubId });
    expect(third.error?.message).toMatch(/No sessions left/);
  });

  it("members can't log sessions for themselves", async () => {
    const { error } = await as.member.rpc("log_pt_session", { p_pt_subscription_id: ptSubId });
    expect(error?.message).toMatch(/Only staff or this client's trainer/);
  });

  it("the member sees their package and sessions used in the app", async () => {
    const { data, error } = await as.member.rpc("my_pt_subscriptions", { p_gym_id: gymId });
    expect(error?.message).toBeUndefined();
    expect(data!.find((s) => s.id === ptSubId)).toBeTruthy();
    const other = await as.member2.rpc("my_pt_subscriptions", { p_gym_id: gymId });
    expect(other.data!.find((s) => s.id === ptSubId)).toBeUndefined();
  });

  it("members can't edit PT packages they bought", async () => {
    const res = await as.member.from("pt_subscriptions").update({ sessions_total: 99 }).eq("id", ptSubId).select("id");
    expect(refused(res)).toBe(true);
    const { data } = await service.from("pt_subscriptions").select("sessions_total").eq("id", ptSubId).single();
    expect(data!.sessions_total).toBe(2);
  });
});
