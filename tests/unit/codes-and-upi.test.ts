import { describe, expect, it } from "vitest";
import { gymSlugSchema, isCheckinToken, parseGymCode, parsePosterCode, posterCheckinUrl, upiIdSchema, upiPayLink, utrSchema } from "@gymos/shared";

describe("UPI ID", () => {
  it.each(["armsfitness@okhdfcbank", "arms.fitness-01@okicici", "9876543210@ybl", `${"a".repeat(64)}@okaxis`])("accepts %s", (id) => {
    expect(upiIdSchema.safeParse(id).success).toBe(true);
  });

  it.each(["nobank", "my gym@okicici", "a@b", "x@ok-hdfc", `${"a".repeat(65)}@okaxis`])("rejects %s", (id) => {
    expect(upiIdSchema.safeParse(id).success).toBe(false);
  });

  it("builds a UPI pay link apps accept (no + or %40)", () => {
    const link = upiPayLink({ upiId: "arms@okhdfcbank", payeeName: "Arms Fitness", amountPaise: 149950, note: "Monthly plan" });
    expect(link).toBe("upi://pay?pa=arms@okhdfcbank&pn=Arms%20Fitness&am=1499.50&cu=INR&tn=Monthly%20plan");
  });

  it("reference numbers are optional and upper-cased", () => {
    expect(utrSchema.parse(" ab12cd34ef56 ")).toBe("AB12CD34EF56");
    expect(utrSchema.safeParse("").success).toBe(true);
    expect(utrSchema.safeParse("12-34").success).toBe(false);
  });
});

describe("gym codes", () => {
  it.each([
    ["Iron-Fit", "iron-fit"],
    ["https://gos.app/join/arms-fitness?x=1", "arms-fitness"],
    ["  demo-fitness ", "demo-fitness"],
  ])("reads %j as %s", (input, code) => {
    expect(parseGymCode(input)).toBe(code);
  });

  it.each(["ab", "iron--fit", "-iron", "iron fit", "a".repeat(41)])("rejects %j", (code) => {
    expect(gymSlugSchema.safeParse(code).success).toBe(false);
  });
});

describe("check-in codes", () => {
  it("poster links round-trip", () => {
    const url = posterCheckinUrl("https://gos.app/", "arms-fitness", "3.ab12cd");
    expect(url).toBe("https://gos.app/checkin/arms-fitness?k=3.ab12cd");
    expect(parsePosterCode(url)).toEqual({ slug: "arms-fitness", key: "3.ab12cd" });
  });

  it("ignores QR codes that aren't gym posters", () => {
    expect(parsePosterCode("https://example.com/menu")).toBeNull();
    expect(parsePosterCode("upi://pay?pa=x@ybl")).toBeNull();
  });

  it("recognises a member's desk QR code", () => {
    expect(isCheckinToken("gymos-ci:abc:123:sig")).toBe(true);
    expect(isCheckinToken("https://gos.app/checkin/x?k=1.a")).toBe(false);
  });
});
