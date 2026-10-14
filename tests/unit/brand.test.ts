import { describe, expect, it } from "vitest";
import { BRAND, GYM_DEFAULTS, renderTemplate } from "@gymos/shared";

describe("product name", () => {
  it("comes from one place and fills {app} in messages", () => {
    expect(BRAND.name.length).toBeGreaterThan(0);
    expect(BRAND.logo.join("")).toBe(BRAND.name);
    expect(renderTemplate("Renew in the {app} app, {name}.", { name: "Asha" })).toBe(`Renew in the ${BRAND.name} app, Asha.`);
  });

  it("keeps the name out of the saved default reminder", () => {
    expect(GYM_DEFAULTS.renewal_message).toContain("{app}");
    expect(GYM_DEFAULTS.renewal_message).not.toContain(BRAND.name);
  });
});
