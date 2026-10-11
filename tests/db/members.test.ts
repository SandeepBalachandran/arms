import { afterAll, describe, expect, it } from "vitest";
import { as, fx, memberId, refused, service, setGym } from "./fixture";

const gymId = fx.gym.id;

describe("joining a gym", () => {
  it("joins straight away when approval is off", async () => {
    await setGym({ join_requires_approval: false });
    const { data } = await service.from("gym_members").select("status").eq("id", memberId("member")).single();
    expect(data!.status).toBe("active");
  });

  it("with approval on, a new member waits until staff approve", async () => {
    await setGym({ join_requires_approval: true });
    const { error } = await as.outsider.rpc("join_gym", { p_slug: fx.gym.slug });
    expect(error?.message).toBeUndefined();
    const { data: row } = await as.outsider.from("gym_members").select("id, status").eq("gym_id", gymId).single();
    expect(row!.status).toBe("pending");

    // A pending member can't use member features yet.
    expect((await as.outsider.rpc("self_check_in", { p_gym_id: gymId })).error).not.toBeNull();
    // Members can't approve; staff can, once.
    expect((await as.member.rpc("review_join_request", { p_member_id: row!.id, p_approve: true })).error?.message).toMatch(/Not allowed/);
    expect((await as.staff.rpc("review_join_request", { p_member_id: row!.id, p_approve: true })).error?.message).toBeUndefined();
    expect((await as.staff.rpc("review_join_request", { p_member_id: row!.id, p_approve: true })).error?.message).toMatch(/already handled/);
  });

  afterAll(async () => {
    await service.from("gym_members").delete().eq("gym_id", gymId).eq("user_id", fx.users.outsider.id);
    await setGym({ join_requires_approval: false });
  });

  it("an unknown gym code says so", async () => {
    const { error } = await as.outsider.rpc("join_gym", { p_slug: "no-such-gym-zzz" });
    expect(error?.message).toMatch(/Gym not found/);
  });
});

describe("who can see members", () => {
  it("the team sees every member; a member sees only their own row", async () => {
    const team = await as.trainer.from("gym_members").select("id").eq("gym_id", gymId);
    expect(team.data!.length).toBeGreaterThanOrEqual(6);
    const own = await as.member.from("gym_members").select("id").eq("gym_id", gymId);
    expect(own.data!.map((r) => r.id)).toEqual([memberId("member")]);
  });

  it("members can't read other members' profiles (names, phones)", async () => {
    const { data } = await as.member.from("profiles").select("id").eq("id", fx.users.member2.id);
    expect(data).toEqual([]);
  });

  it("staff can read member profiles", async () => {
    const { data } = await as.staff.from("profiles").select("full_name").eq("id", fx.users.member.id);
    expect(data).toHaveLength(1);
  });
});

describe("roles", () => {
  const setRole = (who: keyof typeof as, target: string, role: "member" | "staff" | "trainer" | "admin" | "owner") =>
    as[who].from("gym_members").update({ role }).eq("id", target).select("id");

  afterAll(async () => {
    await service.from("gym_members").update({ role: "member" }).eq("id", memberId("member2"));
    await service.from("gym_members").update({ role: "admin" }).eq("id", memberId("admin"));
  });

  it("the owner can make someone an admin", async () => {
    expect(refused(await setRole("owner", memberId("member2"), "admin"))).toBe(false);
    await setRole("owner", memberId("member2"), "member");
  });

  it("an admin can't make someone an admin or owner", async () => {
    expect(refused(await setRole("admin", memberId("member2"), "admin"))).toBe(true);
    expect(refused(await setRole("admin", memberId("member2"), "owner"))).toBe(true);
  });

  it("staff can't make anyone admin", async () => {
    expect(refused(await setRole("staff", memberId("member2"), "admin"))).toBe(true);
  });

  it("staff can't demote an admin", async () => {
    const res = await setRole("staff", memberId("admin"), "member");
    const { data } = await service.from("gym_members").select("role").eq("id", memberId("admin")).single();
    expect(data!.role).toBe("admin");
    expect(refused(res)).toBe(true);
  });

  it("nobody can change the owner's role", async () => {
    expect(refused(await setRole("admin", memberId("owner"), "member"))).toBe(true);
  });

  it("members and trainers can't change roles", async () => {
    expect(refused(await setRole("member", memberId("member"), "staff"))).toBe(true);
    expect(refused(await setRole("trainer", memberId("member2"), "staff"))).toBe(true);
  });
});

describe("plans", () => {
  it("owner/admin add plans; staff and members can't", async () => {
    const row = { gym_id: gymId, name: "Test plan", price_paise: 100000, duration_days: 30 };
    expect(refused(await as.staff.from("plans").insert(row).select("id"))).toBe(true);
    expect(refused(await as.member.from("plans").insert(row).select("id"))).toBe(true);
    const ok = await as.admin.from("plans").insert(row).select("id").single();
    expect(ok.error?.message).toBeUndefined();
    await service.from("plans").delete().eq("id", ok.data!.id);
  });

  it("members see active plans only", async () => {
    const { data: hidden } = await service.from("plans").insert({ gym_id: gymId, name: "Old plan", price_paise: 1, duration_days: 1, is_active: false }).select("id").single();
    const seen = await as.member.from("plans").select("id").eq("gym_id", gymId);
    expect(seen.data!.map((p) => p.id)).toContain(fx.planId);
    expect(seen.data!.map((p) => p.id)).not.toContain(hidden!.id);
    await service.from("plans").delete().eq("id", hidden!.id);
  });
});

describe("payments at the desk", () => {
  it("staff record a cash payment, which starts a membership", async () => {
    const { data: subId, error } = await as.staff.rpc("record_manual_payment", {
      p_member_id: memberId("member"), p_plan_id: fx.planId, p_method: "cash",
    });
    expect(error?.message).toBeUndefined();
    const { data: sub } = await as.member.from("subscriptions").select("plan_name, status, starts_on, ends_on").eq("id", subId!).single();
    expect(sub).toMatchObject({ plan_name: "Monthly", status: "active" });
    const { data: pay } = await as.member.from("payments").select("amount_paise, status, receipt_no").eq("subscription_id", subId!).single();
    expect(pay).toMatchObject({ amount_paise: 150000, status: "paid" });
  });

  it("a renewal starts the day after the current membership ends", async () => {
    const before = await service.from("subscriptions").select("ends_on").eq("member_id", memberId("member")).eq("status", "active").order("ends_on", { ascending: false }).limit(1).single();
    const { data: subId } = await as.staff.rpc("record_manual_payment", { p_member_id: memberId("member"), p_plan_id: fx.planId, p_method: "upi" });
    const { data: renewal } = await service.from("subscriptions").select("starts_on").eq("id", subId!).single();
    const next = new Date(`${before.data!.ends_on}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    expect(renewal!.starts_on).toBe(next.toISOString().slice(0, 10));
  });

  it("refuses a payment method the gym switched off", async () => {
    await setGym({ manual_payment_methods: ["cash"] });
    const { error } = await as.staff.rpc("record_manual_payment", { p_member_id: memberId("member2"), p_plan_id: fx.planId, p_method: "card" });
    expect(error?.message).toMatch(/does not accept that payment method/);
    await setGym({ manual_payment_methods: ["cash", "upi", "card", "bank_transfer"] });
  });

  it.each(["trainer", "member"] as const)("%s can't record payments", async (role) => {
    const { error } = await as[role].rpc("record_manual_payment", { p_member_id: memberId("member2"), p_plan_id: fx.planId, p_method: "cash" });
    expect(error?.message).toMatch(/Not allowed/);
  });

  it("trainers can't see payments; members see only their own", async () => {
    expect((await as.trainer.from("payments").select("id").eq("gym_id", gymId)).data).toEqual([]);
    const mine = await as.member2.from("payments").select("member_id").eq("gym_id", gymId);
    expect(mine.data!.every((p) => p.member_id === memberId("member2"))).toBe(true);
    expect((await as.staff.from("payments").select("id").eq("gym_id", gymId)).data!.length).toBeGreaterThan(0);
  });

  it("members can't create or edit payments directly", async () => {
    const insert = await as.member.from("payments").insert({ gym_id: gymId, member_id: memberId("member"), amount_paise: 1, method: "cash", status: "paid" }).select("id");
    expect(refused(insert)).toBe(true);
    const update = await as.member.from("payments").update({ amount_paise: 1 }).eq("member_id", memberId("member")).select("id");
    expect(refused(update)).toBe(true);
  });

  it("only staff can cancel a membership", async () => {
    const { data: subId } = await as.staff.rpc("record_manual_payment", { p_member_id: memberId("member2"), p_plan_id: fx.planId, p_method: "cash" });
    expect((await as.member2.rpc("cancel_subscription", { p_subscription_id: subId! })).error?.message).toMatch(/Not allowed/);
    expect((await as.staff.rpc("cancel_subscription", { p_subscription_id: subId! })).error?.message).toBeUndefined();
    const { data } = await service.from("subscriptions").select("status").eq("id", subId!).single();
    expect(data!.status).toBe("cancelled");
  });
});

describe("UPI payments in the app", () => {
  it("can't claim before the gym adds a UPI ID", async () => {
    await setGym({ upi_id: null, upi_payee_name: null });
    const { error } = await as.member2.rpc("claim_upi_payment", { p_gym_id: gymId, p_plan_id: fx.planId });
    expect(error?.message).toMatch(/does not accept UPI/);
  });

  it("member claims, staff confirm, and the membership starts", async () => {
    await setGym({ upi_id: "testgym@okhdfcbank", upi_payee_name: "Test Gym" });
    const { data: paymentId, error } = await as.member2.rpc("claim_upi_payment", { p_gym_id: gymId, p_plan_id: fx.planId, p_utr: "123456789012" });
    expect(error?.message).toBeUndefined();

    // Only one waiting payment at a time.
    expect((await as.member2.rpc("claim_upi_payment", { p_gym_id: gymId, p_plan_id: fx.planId })).error?.message).toMatch(/already have a payment waiting/);
    // Members can't confirm their own payment.
    expect((await as.member2.rpc("confirm_upi_payment", { p_payment_id: paymentId! })).error?.message).toMatch(/Not allowed/);

    const { data: subId, error: confirmError } = await as.staff.rpc("confirm_upi_payment", { p_payment_id: paymentId! });
    expect(confirmError?.message).toBeUndefined();
    const { data: sub } = await as.member2.from("subscriptions").select("status").eq("id", subId!).single();
    expect(sub!.status).toBe("active");
    expect((await as.staff.rpc("confirm_upi_payment", { p_payment_id: paymentId! })).error?.message).toMatch(/already reviewed/);
  });

  it("staff can reject a claim, and members can withdraw their own", async () => {
    const claim = await as.member2.rpc("claim_upi_payment", { p_gym_id: gymId, p_plan_id: fx.planId });
    expect((await as.staff.rpc("reject_upi_payment", { p_payment_id: claim.data!, p_reason: "Not received" })).error?.message).toBeUndefined();

    const again = await as.member2.rpc("claim_upi_payment", { p_gym_id: gymId, p_plan_id: fx.planId });
    expect((await as.member.rpc("withdraw_upi_payment", { p_payment_id: again.data! })).error?.message).toBeUndefined();
    const stillThere = await service.from("payments").select("status").eq("id", again.data!).single();
    expect(stillThere.data!.status).toBe("created"); // someone else's withdraw does nothing
    expect((await as.member2.rpc("withdraw_upi_payment", { p_payment_id: again.data! })).error?.message).toBeUndefined();
    const gone = await service.from("payments").select("id").eq("id", again.data!);
    expect(gone.data).toEqual([]);
  });
});
