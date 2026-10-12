import { afterAll, describe, expect, it } from "vitest";
import { as, fx, memberId, refused, service, setGym } from "./fixture";

// Notifications are written by triggers when something happens to a member,
// and only that member can read them (or mark them read).
const gymId = fx.gym.id;
const m2 = () => memberId("member2");

async function latest(kind: string, since: string) {
  const { data } = await service.from("notifications").select("kind, data, read_at").eq("member_id", m2()).eq("kind", kind).gte("created_at", since);
  return data ?? [];
}
const stamp = () => new Date(Date.now() - 1000).toISOString();

afterAll(async () => {
  await service.from("notifications").delete().eq("gym_id", gymId);
});

describe("notifications", () => {
  it("a payment at the desk tells the member, with the receipt", async () => {
    const since = stamp();
    const { error } = await as.staff.rpc("record_manual_payment", { p_member_id: m2(), p_plan_id: fx.planId, p_method: "cash" });
    expect(error?.message).toBeUndefined();
    const [n] = await latest("payment_paid", since);
    expect(n.data).toMatchObject({ amount_paise: 150000, what: "Monthly", method: "cash" });
    expect((n.data as { receipt: string }).receipt).toMatch(/^#\d+$/);
  });

  it("a rejected UPI payment says why", async () => {
    const since = stamp();
    await setGym({ upi_id: "testgym@okaxis", upi_payee_name: "Test Gym" });
    await service.from("payments").delete().eq("member_id", m2()).eq("status", "created");
    const claim = await as.member2.rpc("claim_upi_payment", { p_gym_id: gymId, p_plan_id: fx.planId });
    expect(claim.error?.message).toBeUndefined();
    expect((await as.staff.rpc("reject_upi_payment", { p_payment_id: claim.data!, p_reason: "Not in our account" })).error).toBeNull();
    const [n] = await latest("payment_rejected", since);
    expect(n.data).toMatchObject({ amount_paise: 150000, reason: "Not in our account" });
  });

  it("cancelling a class tells everyone booked on it", async () => {
    const since = stamp();
    const type = await service.from("class_types").insert({ gym_id: gymId, name: "Spin", default_capacity: 5, default_duration_min: 45 }).select("id").single();
    const startsAt = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const session = await service.from("class_sessions").insert({ gym_id: gymId, class_type_id: type.data!.id, starts_at: startsAt, duration_min: 45, capacity: 5 }).select("id").single();
    await service.from("class_bookings").insert({ gym_id: gymId, session_id: session.data!.id, member_id: m2(), status: "booked" });
    expect((await as.staff.rpc("cancel_class_session", { p_session_id: session.data!.id, p_reason: "Trainer unwell" })).error).toBeNull();
    const [n] = await latest("class_cancelled", since);
    expect(n.data).toMatchObject({ class_name: "Spin", reason: "Trainer unwell" });
    await service.from("class_types").delete().eq("id", type.data!.id);
  });

  it("a trainer's comment, a new plan and a PT session each tell the member", async () => {
    const since = stamp();
    await service.from("nutrition_comments").insert({ gym_id: gymId, member_id: m2(), author_member_id: memberId("trainer"), day: "2026-10-12", body: "More protein" });
    const plan = await service.from("workout_plans").insert({ gym_id: gymId, name: "Notify plan" }).select("id").single();
    await service.from("plan_assignments").insert({ gym_id: gymId, member_id: m2(), plan_id: plan.data!.id, assigned_by: memberId("trainer") });
    const pt = await service.from("pt_subscriptions").insert({ gym_id: gymId, member_id: m2(), package_name: "4 PT", sessions_total: 4, starts_on: "2026-10-01", ends_on: "2026-12-31", trainer_member_id: memberId("trainer") }).select("id").single();
    await service.from("pt_sessions").insert({ gym_id: gymId, pt_subscription_id: pt.data!.id, session_on: "2026-10-12", notes: "Legs" });

    expect((await latest("trainer_comment", since))[0].data).toMatchObject({ author: "Tom Trainer", body: "More protein" });
    expect((await latest("plan_assigned", since))[0].data).toMatchObject({ plan_name: "Notify plan", author: "Tom Trainer" });
    expect((await latest("pt_session", since))[0].data).toMatchObject({ package_name: "4 PT", sessions_left: 3, notes: "Legs" });

    await service.from("workout_plans").delete().eq("id", plan.data!.id);
    await service.from("pt_subscriptions").delete().eq("id", pt.data!.id);
  });

  it("a member's own comment on their log doesn't notify them", async () => {
    const since = stamp();
    await service.from("nutrition_comments").insert({ gym_id: gymId, member_id: m2(), author_member_id: m2(), day: "2026-10-12", body: "Note to self" });
    expect(await latest("trainer_comment", since)).toEqual([]);
  });

  it("only the member sees them, and can only mark them read", async () => {
    const mine = await as.member2.from("notifications").select("id, kind").eq("member_id", m2());
    expect(mine.data!.length).toBeGreaterThan(0);
    for (const role of ["member", "staff", "owner", "trainer", "outsider"] as const) {
      expect(refused(await as[role].from("notifications").select("id").eq("member_id", m2())), role).toBe(true);
    }
    expect(refused(await as.member2.from("notifications").insert({ gym_id: gymId, member_id: m2(), kind: "payment_paid", data: {} }).select("id"))).toBe(true);
    expect((await as.member2.from("notifications").update({ data: { forged: true } }).eq("member_id", m2())).error).toBeTruthy();
    expect((await as.member.from("notifications").update({ read_at: new Date().toISOString() }).eq("member_id", m2()).select("id")).data).toEqual([]);

    const read = await as.member2.from("notifications").update({ read_at: new Date().toISOString() }).eq("member_id", m2()).is("read_at", null).select("id");
    expect(read.error).toBeNull();
    expect(read.data!.length).toBeGreaterThan(0);
  });
});
