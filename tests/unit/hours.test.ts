import { describe, expect, it } from "vitest";
import { checkinOpenNow, describeOpenStatus, formatClock, openStatus, openingHoursSchema, parseOpeningHours } from "@gymos/shared";

const weekday = { morning: ["05:00", "10:00"], evening: ["16:00", "21:00"] };
const HOURS = parseOpeningHours({ mon: weekday, tue: weekday, wed: weekday, thu: weekday, fri: weekday, sat: weekday, sun: { morning: ["06:00", "10:00"] } });
const TZ = "Asia/Kolkata";
// 2026-10-12 is a Monday; times are India time.
const at = (local: string) => new Date(`${local}+05:30`);

describe("openStatus", () => {
  it.each([
    ["2026-10-12T07:00", "Open now · until 10:00 am"],
    ["2026-10-12T12:00", "Closed · opens 4:00 pm"],
    ["2026-10-12T22:00", "Closed · opens tomorrow 5:00 am"],
    ["2026-10-11T12:00", "Closed · opens tomorrow 5:00 am"], // Sunday afternoon
    ["2026-10-10T22:00", "Closed · opens tomorrow 6:00 am"], // Saturday night → Sunday's later start
  ])("%s → %s", (time, text) => {
    expect(describeOpenStatus(openStatus(HOURS, TZ, at(time)))).toBe(text);
  });

  it("closing time itself counts as closed", () => {
    expect(openStatus(HOURS, TZ, at("2026-10-12T10:00")).open).toBe(false);
  });

  it("says just 'Closed' when no day has hours", () => {
    expect(describeOpenStatus(openStatus(parseOpeningHours({}), TZ, at("2026-10-12T07:00")))).toBe("Closed");
  });

  it("uses the gym's time zone, not the phone's", () => {
    // 01:30 UTC is 07:00 in India (open) but 21:30 the day before in New York.
    const instant = new Date("2026-10-12T01:30:00Z");
    expect(openStatus(HOURS, TZ, instant).open).toBe(true);
  });
});

describe("checkinOpenNow (members may check in 15 min early)", () => {
  it.each([
    ["2026-10-12T04:44", false],
    ["2026-10-12T04:45", true],
    ["2026-10-12T09:59", true],
    ["2026-10-12T10:00", false],
    ["2026-10-12T15:45", true],
    ["2026-10-12T21:00", false],
  ])("%s → %s", (time, open) => {
    expect(checkinOpenNow(HOURS, TZ, at(time))).toBe(open);
  });

  it("never blocks a gym with no hours set", () => {
    expect(checkinOpenNow(parseOpeningHours({}), TZ, at("2026-10-12T03:00"))).toBe(true);
  });
});

describe("opening hours input", () => {
  it("rejects closing before opening", () => {
    expect(openingHoursSchema.safeParse({ mon: { morning: ["10:00", "05:00"] } }).success).toBe(false);
  });

  it("rejects an evening that starts before the morning ends", () => {
    expect(openingHoursSchema.safeParse({ mon: { morning: ["05:00", "12:00"], evening: ["11:00", "20:00"] } }).success).toBe(false);
  });

  it("treats anything malformed as closed rather than crashing", () => {
    expect(parseOpeningHours("garbage").mon).toEqual({});
  });

  it("formats times the Indian way", () => {
    expect([formatClock("05:00"), formatClock("12:30"), formatClock("00:15")]).toEqual(["5:00 am", "12:30 pm", "12:15 am"]);
  });
});
