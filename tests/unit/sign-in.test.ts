import { describe, expect, it } from "vitest";
import { isPin, isPlaceholderEmail, placeholderEmail, shownEmail } from "@gymos/shared";

describe("phone + PIN sign-in helpers", () => {
  it("accepts exactly six digits as a PIN", () => {
    expect(isPin("482193")).toBe(true);
    expect(isPin("000000")).toBe(true);
    expect(isPin("48219")).toBe(false);
    expect(isPin("4821934")).toBe(false);
    expect(isPin("48 219")).toBe(false);
    expect(isPin("abcdef")).toBe(false);
  });

  it("builds and recognises the placeholder address", () => {
    const email = placeholderEmail("919847012345");
    expect(email).toBe("919847012345@phone.squatpress.invalid");
    expect(isPlaceholderEmail(email)).toBe(true);
    expect(isPlaceholderEmail("asha@example.com")).toBe(false);
    expect(isPlaceholderEmail(null)).toBe(false);
  });

  it("never shows the placeholder", () => {
    expect(shownEmail(placeholderEmail("919847012345"))).toBeNull();
    expect(shownEmail("asha@example.com")).toBe("asha@example.com");
    expect(shownEmail(undefined)).toBeNull();
  });
});
