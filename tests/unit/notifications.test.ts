import { describe, expect, it } from "vitest";
import { describeNotification, relativeDay, timeAgo } from "@gymos/shared";

const gym = { timezone: "Asia/Kolkata", currency: "INR" };
const now = new Date("2026-10-12T06:30:00Z"); // 12 Oct, 12:00 in India

describe("describeNotification", () => {
  it("a payment links to its receipt", () => {
    expect(describeNotification("payment_paid", { payment_id: "p1", amount_paise: 150000, receipt: "AF-42", what: "Monthly" }, gym, now)).toEqual({
      title: "Payment received: ₹1,500",
      body: "Monthly · Receipt AF-42",
      link: "/receipt/p1",
      tone: "good",
    });
  });

  it("a rejected UPI payment shows the gym's reason", () => {
    const v = describeNotification("payment_rejected", { amount_paise: 99900, reason: "Not in our account" }, gym, now);
    expect(v).toMatchObject({ title: "UPI payment of ₹999 not confirmed", body: "Not in our account", link: "/membership", tone: "bad" });
  });

  it("a cancelled class says when, in the gym's time zone", () => {
    const v = describeNotification("class_cancelled", { class_name: "Yoga", starts_at: "2026-10-13T01:00:00Z", reason: "Trainer unwell" }, gym, now);
    expect(v.title).toBe("Yoga cancelled");
    expect(v.body).toMatch(/^Tomorrow, 6:30\s?am · Trainer unwell$/i);
  });

  it("a trainer's comment, a new plan and a PT session", () => {
    expect(describeNotification("trainer_comment", { author: "Tara", body: "Good protein today" }, gym, now)).toMatchObject({
      title: "Tara commented on your food log",
      body: "Good protein today",
      link: "/food",
    });
    expect(describeNotification("plan_assigned", { plan_name: "Push Pull Legs", author: "Tara" }, gym, now)).toMatchObject({
      title: "New workout plan: Push Pull Legs",
      body: "From Tara",
      link: "/workouts",
    });
    expect(describeNotification("pt_session", { session_on: "2026-10-12", sessions_left: 1 }, gym, now).body).toBe("Today · 1 session left");
  });

  it("an unknown kind still shows something", () => {
    expect(describeNotification("something_new", {}, gym, now)).toMatchObject({ title: "Update from your gym", link: null });
  });
});

describe("dates", () => {
  it("relative days", () => {
    expect(relativeDay("2026-10-12", "2026-10-12")).toBe("Today");
    expect(relativeDay("2026-10-11", "2026-10-12")).toBe("Yesterday");
    expect(relativeDay("2026-10-13", "2026-10-12")).toBe("Tomorrow");
    expect(relativeDay("2026-10-01", "2026-10-12")).toBe("1 Oct 2026");
  });

  it("time ago", () => {
    expect(timeAgo("2026-10-12T06:29:40Z", now)).toBe("Just now");
    expect(timeAgo("2026-10-12T06:00:00Z", now)).toBe("30m");
    expect(timeAgo("2026-10-12T01:30:00Z", now)).toBe("5h");
    expect(timeAgo("2026-10-09T06:30:00Z", now)).toBe("3d");
    expect(timeAgo("2026-09-01T06:30:00Z", now)).toBe("1 Sept 2026");
  });
});
