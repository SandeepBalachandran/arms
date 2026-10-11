import { admin, expect, fx, service, signedInAs, test, watchErrors } from "../fixture";

test.describe("trainer", () => {
  signedInAs("admin", "trainer");

  test("logs a PT session for their client", async ({ page }) => {
    const noErrors = watchErrors(page);
    await page.goto(`${admin}/pt`);
    const row = page.locator("tr").filter({ hasText: fx.users.member.name });
    await row.getByRole("button", { name: "Log session" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/^Note/).fill("Upper body");
    await dialog.getByRole("button", { name: "Log session" }).click();
    await expect(dialog).toBeHidden();
    const { data } = await service.from("pt_sessions").select("notes, pt_subscriptions!inner(member_id)").eq("pt_subscriptions.member_id", fx.users.member.memberId!);
    expect(data!.map((s) => s.notes)).toContain("Upper body");
    noErrors();
  });

  test("sets nutrition targets and comments on the member page", async ({ page }) => {
    const noErrors = watchErrors(page);
    await page.goto(`${admin}/members/${fx.users.member.memberId}`);
    await page.getByLabel("Calories / day").fill("2200");
    await page.getByLabel("Protein (g) / day").fill("140");
    await page.getByRole("button", { name: /Set targets|Update targets/ }).click();
    await expect(page.getByText("Targets saved")).toBeVisible();

    await page.getByLabel("Comment").fill("Great start, keep protein up");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Comment sent")).toBeVisible();
    const { data } = await service.from("nutrition_targets").select("kcal, protein_g").eq("member_id", fx.users.member.memberId!).single();
    expect(data).toEqual({ kcal: 2200, protein_g: 140 });
    noErrors();
  });

  test("can't open settings or payments", async ({ page }) => {
    for (const path of ["/settings", "/payments"]) {
      const res = await page.goto(`${admin}${path}`);
      expect(res?.status(), path).toBe(404);
    }
    await page.goto(admin);
    await expect(page.getByRole("link", { name: "Payments" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
  });
});

test.describe("front desk", () => {
  signedInAs("admin", "staff");

  test("can't open settings, and sees no nutrition data", async ({ page }) => {
    expect((await page.goto(`${admin}/settings`))?.status()).toBe(404);
    await page.goto(`${admin}/members/${fx.users.member.memberId}`);
    await expect(page.getByText("Calories / day")).toHaveCount(0);
  });
});

test.describe("member", () => {
  signedInAs("admin", "member");

  test("can't open the admin at all", async ({ page }) => {
    const res = await page.goto(admin);
    expect(res?.status()).toBe(404);
  });
});
