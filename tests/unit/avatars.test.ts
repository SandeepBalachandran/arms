import { describe, expect, it } from "vitest";
import { avatarPath, initials } from "@gymos/shared";

describe("avatars", () => {
  it("initials from a name", () => {
    expect(initials("Ravi Kumar")).toBe("RK");
    expect(initials("  anil  k  menon ")).toBe("AM");
    expect(initials("Ravi")).toBe("RA");
    expect(initials("")).toBe("?");
  });

  it("a new file in the person's own folder each time", () => {
    expect(avatarPath("u1", "jpg", 1760000000000)).toBe("u1/1760000000000.jpg");
    expect(avatarPath("u1")).toMatch(/^u1\/\d+\.jpg$/);
  });
});
