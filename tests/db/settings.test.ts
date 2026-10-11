import { afterAll, describe, expect, it } from "vitest";
import { as, fx, refused, service } from "./fixture";

const gymId = fx.gym.id;

// Saves the same values the admin Settings page sends, as owner/admin, so a
// broken database rule (like the old UPI ID check) fails here first.
const update = (role: keyof typeof as, patch: Record<string, unknown>) =>
  as[role].from("gyms").update(patch as never).eq("id", gymId).select("id");

const SECTIONS: Record<string, Record<string, unknown>> = {
  general: { name: "Test Gym Renamed", phone: "9876543210", phone_country_code: "91", address: "MG Road, Kochi", timezone: "Asia/Kolkata", currency: "INR" },
  hours: { opening_hours: { mon: { morning: ["05:00", "10:00"], evening: ["16:00", "21:00"] }, sun: {} }, opening_hours_note: "Closed on public holidays" },
  memberships: { expiry_warning_days: 5, renewal_message: "Hi {name}, your plan ends on {end_date}.", receipt_prefix: "TG-", manual_payment_methods: ["cash", "upi"], join_requires_approval: false },
  upi: { upi_id: "arms.fitness-01@okhdfcbank", upi_payee_name: "Arms Fitness" },
  checkin: { checkin_enabled: true, checkin_self_allowed: true, checkin_only_when_open: true, checkin_dedupe_hours: 3 },
  poster: { checkin_poster_enabled: true, checkin_location_required: true, latitude: 9.9312, longitude: 76.2673, checkin_radius_m: 250 },
  classes: { classes_enabled: true, classes_booking_window_days: 7, classes_cancel_cutoff_hours: 2, classes_require_membership: true },
  workouts: { workouts_enabled: true },
  pt: { pt_enabled: true, pt_show_in_app: true, pt_expiry_warning_sessions: 2 },
  nutrition: { nutrition_enabled: true, nutrition_all_members: false },
};

describe("saving settings", () => {
  afterAll(async () => {
    await service.from("gyms").update({ name: fx.gym.name }).eq("id", gymId);
  });

  it.each(Object.entries(SECTIONS))("owner saves %s", async (_name, patch) => {
    const res = await update("owner", patch);
    expect(res.error?.message).toBeUndefined();
    expect(res.data).toHaveLength(1);
  });

  it("admin can save settings too", async () => {
    expect(refused(await update("admin", SECTIONS.workouts))).toBe(false);
  });

  it.each(["staff", "trainer", "member", "outsider"] as const)("%s can't change settings", async (role) => {
    expect(refused(await update(role, { name: "Hacked" }))).toBe(true);
    const { data } = await service.from("gyms").select("name").eq("id", gymId).single();
    expect(data!.name).not.toBe("Hacked");
  });

  it.each([
    ["UPI ID without @", { upi_id: "nobank" }],
    ["UPI ID with spaces", { upi_id: "my gym@okicici" }],
    ["location out of range", { latitude: 120 }],
    ["poster radius too small", { checkin_radius_m: 10 }],
  ])("rejects %s", async (_label, patch) => {
    expect((await update("owner", patch)).error).not.toBeNull();
  });

  it.each([
    ["the billing plan", { platform_plan: "enterprise" }],
    ["the gym's status", { status: "suspended" }],
    ["the deleted date", { deleted_at: new Date().toISOString() }],
  ])("an owner can't change %s directly", async (_label, patch) => {
    const before = await service.from("gyms").select("platform_plan, status, deleted_at").eq("id", gymId).single();
    await update("owner", patch);
    const after = await service.from("gyms").select("platform_plan, status, deleted_at").eq("id", gymId).single();
    await service.from("gyms").update(before.data!).eq("id", gymId);
    expect(after.data).toEqual(before.data);
  });
});

describe("gym info is public, secrets are not", () => {
  it("anyone can read a gym's public details for the join page", async () => {
    const { data } = await as.outsider.from("gyms").select("name, slug").eq("id", gymId).single();
    expect(data!.slug).toBe(fx.gym.slug);
  });

  it("gym_secrets can't be read by anyone signed in, even the owner", async () => {
    const { data } = await as.owner.from("gym_secrets").select("*");
    expect(data ?? []).toEqual([]);
  });
});
