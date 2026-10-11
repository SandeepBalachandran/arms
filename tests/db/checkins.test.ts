import { beforeEach, describe, expect, it } from "vitest";
import { as, fx, HOURS_ALWAYS, hoursClosedNow, memberId, service, setGym } from "./fixture";

const gymId = fx.gym.id;

beforeEach(async () => {
  // Open all day, every repeat counted, so each test starts from the same place.
  await setGym({
    checkin_enabled: true,
    checkin_self_allowed: true,
    checkin_poster_enabled: false,
    checkin_location_required: false,
    checkin_only_when_open: true,
    checkin_dedupe_hours: 0,
    opening_hours: HOURS_ALWAYS,
  });
});

describe("self check-in", () => {
  it("member can check in while the gym is open", async () => {
    const { data, error } = await as.member.rpc("self_check_in", { p_gym_id: gymId });
    expect(error?.message).toBeUndefined();
    expect(data).toMatchObject({ member_id: memberId("member"), duplicate: false });
  });

  it("is refused while the gym is closed", async () => {
    await setGym({ opening_hours: hoursClosedNow() });
    const { error } = await as.member.rpc("self_check_in", { p_gym_id: gymId });
    expect(error?.message).toMatch(/closed right now/);
  });

  it("works when closed if the gym turned the hours rule off", async () => {
    await setGym({ opening_hours: hoursClosedNow(), checkin_only_when_open: false });
    const { error } = await as.member.rpc("self_check_in", { p_gym_id: gymId });
    expect(error?.message).toBeUndefined();
  });

  it("is never blocked when the gym has no hours set", async () => {
    await setGym({ opening_hours: {} });
    const { error } = await as.member.rpc("self_check_in", { p_gym_id: gymId });
    expect(error?.message).toBeUndefined();
  });

  it("is refused when self check-in is off", async () => {
    await setGym({ checkin_self_allowed: false });
    const { error } = await as.member.rpc("self_check_in", { p_gym_id: gymId });
    expect(error?.message).toMatch(/not available/);
  });

  it("is refused for someone who isn't a member", async () => {
    const { error } = await as.outsider.rpc("self_check_in", { p_gym_id: gymId });
    expect(error).not.toBeNull();
  });

  it("counts repeats within the dedupe window as one visit", async () => {
    await setGym({ checkin_dedupe_hours: 3 });
    const first = await as.member2.rpc("self_check_in", { p_gym_id: gymId });
    const second = await as.member2.rpc("self_check_in", { p_gym_id: gymId });
    expect(second.data).toMatchObject({ duplicate: true, checkin_id: (first.data as { checkin_id: string }).checkin_id });
  });
});

describe("staff check-in", () => {
  it("staff can check a member in by name, even when the gym is closed", async () => {
    await setGym({ opening_hours: hoursClosedNow() });
    const { error } = await as.staff.rpc("staff_check_in", { p_member_id: memberId("member") });
    expect(error?.message).toBeUndefined();
  });

  it.each(["member", "trainer", "outsider"] as const)("%s can't check someone in by name", async (role) => {
    const { error } = await as[role].rpc("staff_check_in", { p_member_id: memberId("member2") });
    expect(error?.message).toMatch(/Not allowed/);
  });

  it("staff can scan a member's QR code", async () => {
    const token = await as.member.rpc("issue_checkin_token", { p_gym_id: gymId });
    expect(token.error?.message).toBeUndefined();
    const { data, error } = await as.staff.rpc("check_in_by_token", { p_token: token.data! });
    expect(error?.message).toBeUndefined();
    expect(data).toMatchObject({ member_id: memberId("member") });
  });

  it("rejects a tampered QR code", async () => {
    const token = await as.member.rpc("issue_checkin_token", { p_gym_id: gymId });
    const forged = token.data!.replace(/[0-9a-f]$/, (c) => (c === "0" ? "1" : "0"));
    const { error } = await as.staff.rpc("check_in_by_token", { p_token: forged });
    expect(error?.message).toMatch(/Invalid check-in code/);
  });

  it("a member can't use someone's QR code to check them in", async () => {
    const token = await as.member.rpc("issue_checkin_token", { p_gym_id: gymId });
    const { error } = await as.member2.rpc("check_in_by_token", { p_token: token.data! });
    expect(error).not.toBeNull();
  });

  it("no QR code when check-in is off", async () => {
    await setGym({ checkin_enabled: false });
    const { error } = await as.member.rpc("issue_checkin_token", { p_gym_id: gymId });
    expect(error?.message).toMatch(/not available/);
  });
});

describe("poster check-in", () => {
  const KOCHI = { lat: 9.9312, lng: 76.2673 };

  async function posterKey() {
    const { data, error } = await as.staff.rpc("checkin_poster_key", { p_gym_id: gymId });
    expect(error?.message).toBeUndefined();
    return data!;
  }

  beforeEach(async () => {
    await setGym({ checkin_poster_enabled: true, latitude: KOCHI.lat, longitude: KOCHI.lng, checkin_radius_m: 200 });
  });

  it("member checks in with the poster code", async () => {
    const { data, error } = await as.member.rpc("poster_check_in", { p_slug: fx.gym.slug, p_key: await posterKey() });
    expect(error?.message).toBeUndefined();
    expect(data).toMatchObject({ gym_id: gymId });
  });

  it("members can't read the poster code themselves", async () => {
    const { error } = await as.member.rpc("checkin_poster_key", { p_gym_id: gymId });
    expect(error?.message).toMatch(/Not allowed/);
  });

  it("rejects a made-up code", async () => {
    const { error } = await as.member.rpc("poster_check_in", { p_slug: fx.gym.slug, p_key: "1.deadbeef" });
    expect(error?.message).toMatch(/out of date/);
  });

  it("is refused while the gym is closed", async () => {
    const key = await posterKey();
    await setGym({ opening_hours: hoursClosedNow() });
    const { error } = await as.member.rpc("poster_check_in", { p_slug: fx.gym.slug, p_key: key });
    expect(error?.message).toMatch(/closed right now/);
  });

  it("refuses non-members", async () => {
    const { error } = await as.outsider.rpc("poster_check_in", { p_slug: fx.gym.slug, p_key: await posterKey() });
    expect(error?.message).toMatch(/not a member/);
  });

  describe("with the location check on", () => {
    beforeEach(() => setGym({ checkin_location_required: true }));

    it("asks for location when the phone sends none", async () => {
      const { error } = await as.member.rpc("poster_check_in", { p_slug: fx.gym.slug, p_key: await posterKey() });
      expect(error?.message).toMatch(/Turn on location/);
    });

    it("refuses a check-in from about 8 km away", async () => {
      const { error } = await as.member.rpc("poster_check_in", {
        p_slug: fx.gym.slug, p_key: await posterKey(), p_lat: 10.0, p_lng: 76.3, p_accuracy_m: 20,
      });
      expect(error?.message).toMatch(/about 8\.\d km/);
    });

    it("accepts a check-in at the gym", async () => {
      const { error } = await as.member.rpc("poster_check_in", {
        p_slug: fx.gym.slug, p_key: await posterKey(), p_lat: 9.932, p_lng: 76.268, p_accuracy_m: 30,
      });
      expect(error?.message).toBeUndefined();
    });
  });

  it("old posters stop working after a reprint, and only owners/admins can reprint", async () => {
    const oldKey = await posterKey();
    expect((await as.staff.rpc("rotate_checkin_poster", { p_gym_id: gymId })).error?.message).toMatch(/Not allowed/);
    expect((await as.admin.rpc("rotate_checkin_poster", { p_gym_id: gymId })).error?.message).toBeUndefined();
    const { error } = await as.member.rpc("poster_check_in", { p_slug: fx.gym.slug, p_key: oldKey });
    expect(error?.message).toMatch(/out of date/);
  });
});

describe("visits", () => {
  it("members see only their own visits; the team sees all", async () => {
    await as.staff.rpc("staff_check_in", { p_member_id: memberId("member2") });
    const mine = await as.member.from("checkins").select("member_id").eq("gym_id", gymId);
    expect(mine.data!.length).toBeGreaterThan(0);
    expect(mine.data!.every((c) => c.member_id === memberId("member"))).toBe(true);

    const team = await as.trainer.from("checkins").select("member_id").eq("gym_id", gymId);
    expect(new Set(team.data!.map((c) => c.member_id)).size).toBeGreaterThan(1);
  });

  it("nobody outside the gym sees its visits", async () => {
    const { data } = await as.outsider.from("checkins").select("id").eq("gym_id", gymId);
    expect(data).toEqual([]);
    const { data: raw } = await service.from("checkins").select("id").eq("gym_id", gymId);
    expect(raw!.length).toBeGreaterThan(0);
  });
});
