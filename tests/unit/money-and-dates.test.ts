import { describe, expect, it } from "vitest";
import { addDays, daysBetween, formatDuration, formatMoney, membershipState, ptState, rupeesSchema, todayIn } from "@gymos/shared";

describe("money", () => {
  it("formats rupees with Indian grouping", () => {
    expect(formatMoney(149900)).toBe("₹1,499");
    expect(formatMoney(12345650)).toBe("₹1,23,456.50");
  });

  it.each([
    ["1499", 149900],
    ["1,499.50", 149950],
    [" 800 ", 80000],
  ])("reads %j as %i paise", (typed, paise) => {
    expect(rupeesSchema.parse(typed)).toBe(paise);
  });

  it.each(["", "abc", "-5", "1.234", "99999999"])("rejects %j", (typed) => {
    expect(rupeesSchema.safeParse(typed).success).toBe(false);
  });
});

describe("dates", () => {
  it("today is in the gym's time zone", () => {
    // 20:00 UTC on the 11th is already the 12th in India.
    expect(todayIn("Asia/Kolkata", new Date("2026-10-11T20:00:00Z"))).toBe("2026-10-12");
  });

  it("adds days across months and leap years", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(daysBetween("2026-10-01", "2026-10-31")).toBe(30);
  });

  it.each([[30, "1 month"], [90, "3 months"], [365, "1 year"], [7, "1 week"], [45, "45 days"]])("%i days → %s", (d, text) => {
    expect(formatDuration(d)).toBe(text);
  });
});

describe("membershipState", () => {
  const sub = (starts_on: string, ends_on: string, status: "active" | "cancelled" | "expired" = "active") => ({ starts_on, ends_on, status });

  it("active, with stacked renewals adding to the days left", () => {
    const state = membershipState([sub("2026-10-01", "2026-10-31"), sub("2026-11-01", "2026-11-30")], "2026-10-21");
    expect(state).toMatchObject({ kind: "active", daysLeft: 41 });
  });

  it("the last day still counts as active", () => {
    expect(membershipState([sub("2026-10-01", "2026-10-31")], "2026-10-31")).toMatchObject({ kind: "active", daysLeft: 1 });
  });

  it("upcoming before it starts", () => {
    expect(membershipState([sub("2026-11-01", "2026-11-30")], "2026-10-25")).toMatchObject({ kind: "upcoming", startsIn: 7 });
  });

  it("expired uses the dates even if the nightly job hasn't run", () => {
    expect(membershipState([sub("2026-09-01", "2026-09-30")], "2026-10-05")).toMatchObject({ kind: "expired", daysAgo: 5 });
  });

  it("ignores cancelled memberships", () => {
    expect(membershipState([sub("2026-09-01", "2026-09-30", "cancelled")], "2026-10-05")).toEqual({ kind: "none" });
  });
});

describe("ptState", () => {
  const pkg = { status: "active", starts_on: "2026-10-01", ends_on: "2026-10-31", sessions_total: 12 };

  it("counts sessions left", () => {
    expect(ptState(pkg, 4, "2026-10-10")).toMatchObject({ kind: "active", left: 8, daysLeft: 22 });
  });

  it("used up beats expired", () => {
    expect(ptState(pkg, 12, "2026-11-05").kind).toBe("used_up");
  });

  it("unlimited packages never run out of sessions", () => {
    expect(ptState({ ...pkg, sessions_total: null }, 40, "2026-10-10")).toMatchObject({ kind: "active", left: null });
  });
});
