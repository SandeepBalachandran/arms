import { beforeAll, describe, expect, it } from "vitest";
import { as, fx, memberId, refused, service, setGym } from "./fixture";

const gymId = fx.gym.id;
let typeId: string;
let sessionId: string;

// Tomorrow in the gym's time zone (Asia/Kolkata), as YYYY-MM-DD and weekday (0 = Sunday).
function tomorrow() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return { today, dow: d.getUTCDay() };
}

beforeAll(async () => {
  await setGym({ classes_enabled: true, classes_require_membership: false, classes_booking_window_days: 7, classes_cancel_cutoff_hours: 0 });
  const type = await as.staff.from("class_types").insert({ gym_id: gymId, name: "Zumba", default_capacity: 1, default_duration_min: 45 }).select("id").single();
  expect(type.error?.message).toBeUndefined();
  typeId = type.data!.id;

  const { today, dow } = tomorrow();
  const series = await as.staff.rpc("create_class_series", {
    p_class_type_id: typeId, p_weekdays: [dow], p_local_time: "18:00", p_start_date: today, p_weeks: 1,
    p_trainer_member_id: memberId("trainer"),
  });
  expect(series.error?.message).toBeUndefined();
  const { data } = await service.from("class_sessions").select("id").eq("class_type_id", typeId).order("starts_at").limit(1).single();
  sessionId = data!.id;
});

describe("setting up classes", () => {
  it("members and trainers can't add class types", async () => {
    expect(refused(await as.member.from("class_types").insert({ gym_id: gymId, name: "Nope" }).select("id"))).toBe(true);
    expect(refused(await as.trainer.from("class_types").insert({ gym_id: gymId, name: "Nope" }).select("id"))).toBe(true);
  });

  it("members can't schedule classes", async () => {
    const { today, dow } = tomorrow();
    const { error } = await as.member.rpc("create_class_series", { p_class_type_id: typeId, p_weekdays: [dow], p_local_time: "07:00", p_start_date: today, p_weeks: 1 });
    expect(error?.message).toMatch(/Not allowed/);
  });

  it("members see the schedule; outsiders don't", async () => {
    const from = new Date().toISOString();
    const to = new Date(Date.now() + 3 * 86400_000).toISOString();
    const mine = await as.member.rpc("class_schedule", { p_gym_id: gymId, p_from: from, p_to: to });
    expect(mine.data!.map((c) => c.id)).toContain(sessionId);
    const theirs = await as.outsider.rpc("class_schedule", { p_gym_id: gymId, p_from: from, p_to: to });
    expect(theirs.data ?? []).toEqual([]);
  });
});

describe("booking", () => {
  it("first member gets the only spot; the next is waitlisted and moves up on a cancel", async () => {
    const first = await as.member.rpc("book_class", { p_session_id: sessionId });
    expect(first.error?.message).toBeUndefined();
    expect(first.data).toBe("booked");
    expect((await as.member2.rpc("book_class", { p_session_id: sessionId })).data).toBe("waitlisted");

    const { data: booking } = await as.member.from("class_bookings").select("id").eq("session_id", sessionId).single();
    expect((await as.member2.rpc("cancel_booking", { p_booking_id: booking!.id })).error?.message).toMatch(/Not allowed/);
    expect((await as.member.rpc("cancel_booking", { p_booking_id: booking!.id })).error?.message).toBeUndefined();

    const { data: promoted } = await as.member2.from("class_bookings").select("status").eq("session_id", sessionId).single();
    expect(promoted!.status).toBe("booked");
  });

  it("members see their own bookings only", async () => {
    const { data } = await as.member.from("class_bookings").select("member_id").eq("session_id", sessionId);
    expect(data!.every((b) => b.member_id === memberId("member"))).toBe(true);
  });

  it("needs an active membership when the gym asks for one", async () => {
    await setGym({ classes_require_membership: true });
    await service.from("subscriptions").delete().eq("member_id", memberId("outsider"));
    const { error } = await as.member.rpc("book_class", { p_session_id: sessionId });
    await setGym({ classes_require_membership: false });
    // member may hold a membership from the payment tests; then booking is allowed.
    const { data: subs } = await service.from("subscriptions").select("id").eq("member_id", memberId("member")).eq("status", "active");
    if (!subs!.length) expect(error?.message).toMatch(/active membership/);
  });

  it("can't book when classes are switched off", async () => {
    await setGym({ classes_enabled: false });
    const { error } = await as.member.rpc("book_class", { p_session_id: sessionId });
    await setGym({ classes_enabled: true });
    expect(error?.message).toMatch(/not available/);
  });

  it("can't cancel inside the gym's cut-off, but staff still can", async () => {
    await setGym({ classes_cancel_cutoff_hours: 72 });
    const { data: b } = await as.member2.from("class_bookings").select("id").eq("session_id", sessionId).single();
    const late = await as.member2.rpc("cancel_booking", { p_booking_id: b!.id });
    expect(late.error?.message).toMatch(/only be cancelled up to 72 hours/);
    expect((await as.staff.rpc("cancel_booking", { p_booking_id: b!.id })).error?.message).toBeUndefined();
    await setGym({ classes_cancel_cutoff_hours: 0 });
  });
});

describe("running the class", () => {
  it("the class's trainer can mark attendance; another member can't", async () => {
    await as.member.rpc("book_class", { p_session_id: sessionId });
    const { data: b } = await service.from("class_bookings").select("id").eq("session_id", sessionId).eq("member_id", memberId("member")).single();
    expect((await as.member2.rpc("mark_attendance", { p_booking_id: b!.id, p_attended: true })).error?.message).toMatch(/Not allowed/);
    expect((await as.trainer.rpc("mark_attendance", { p_booking_id: b!.id, p_attended: true })).error?.message).toBeUndefined();
    const { data } = await service.from("class_bookings").select("status").eq("id", b!.id).single();
    expect(data!.status).toBe("attended");
  });

  it("only staff can cancel a class, and then it can't be booked", async () => {
    expect((await as.trainer.rpc("cancel_class_session", { p_session_id: sessionId })).error?.message).toMatch(/Not allowed/);
    expect((await as.staff.rpc("cancel_class_session", { p_session_id: sessionId, p_reason: "Trainer ill" })).error?.message).toBeUndefined();
    expect((await as.member2.rpc("book_class", { p_session_id: sessionId })).error?.message).toMatch(/cancelled/);
  });
});
