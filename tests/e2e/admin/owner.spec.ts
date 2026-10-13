import { admin, expect, fx, service, signedInAs, test, watchErrors } from "../fixture";

signedInAs("admin", "owner");

test("create a plan", async ({ page }) => {
  const noErrors = watchErrors(page);
  await page.goto(`${admin}/plans`);
  await page.getByRole("button", { name: /New plan|Add plan|Create plan/i }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Plan name").fill("Quarterly");
  await dialog.getByLabel(/^Price/).fill("3999");
  await dialog.getByRole("button", { name: "Create plan" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Quarterly").first()).toBeVisible();
  noErrors();
});

test("give someone a main role and an extra role", async ({ page }) => {
  const noErrors = watchErrors(page);
  const roles = async () => (await service.from("gym_members").select("role, extra_roles").eq("id", fx.users.member2.memberId!).single()).data;
  await page.goto(`${admin}/members`);
  const picker = page.locator("details", { has: page.getByLabel(new RegExp(`^Roles for ${fx.users.member2.name}`)) });
  await picker.locator("summary").click();
  await picker.getByRole("combobox", { name: "Main role" }).selectOption("trainer");
  await picker.getByRole("checkbox", { name: "Staff" }).check();
  await picker.getByRole("button", { name: "Save" }).click();
  await expect(picker.locator("summary")).toContainText("Trainer + Staff");
  await expect.poll(roles).toEqual({ role: "trainer", extra_roles: ["staff"] });

  await picker.locator("summary").click();
  await picker.getByRole("combobox", { name: "Main role" }).selectOption("member");
  await picker.getByRole("checkbox", { name: "Staff" }).uncheck();
  await picker.getByRole("button", { name: "Save" }).click();
  await expect.poll(roles).toEqual({ role: "member", extra_roles: [] });
  noErrors();
});

test.describe("settings", () => {
  test("save a UPI ID", async ({ page }) => {
    const noErrors = watchErrors(page);
    await page.goto(`${admin}/settings`);
    const card = page.locator("form", { has: page.locator("input[name=upi_id]") });
    await card.locator("input[name=upi_id]").fill("arms.fitness@okhdfcbank");
    await card.locator("input[name=upi_payee_name]").fill("Arms Fitness");
    await card.getByRole("button", { name: "Save" }).click();
    await expect.poll(async () => (await service.from("gyms").select("upi_id").eq("id", fx.gym.id).single()).data!.upi_id).toBe("arms.fitness@okhdfcbank");
    await expect(card.getByRole("button", { name: "Save" })).toBeEnabled();
    noErrors();
  });

  test("an invalid UPI ID is explained, not saved", async ({ page }) => {
    await page.goto(`${admin}/settings`);
    const card = page.locator("form", { has: page.locator("input[name=upi_id]") });
    await card.locator("input[name=upi_id]").fill("my gym");
    await card.getByRole("button", { name: "Save" }).click();
    await expect(card.getByText("Enter a UPI ID like name@okhdfcbank")).toBeVisible();
  });

  test("turn the check-in hours rule off and on", async ({ page }) => {
    await page.goto(`${admin}/settings`);
    const card = page.locator("form", { hasText: "Only during opening hours" });
    const read = async () => (await service.from("gyms").select("checkin_only_when_open").eq("id", fx.gym.id).single()).data!.checkin_only_when_open;
    await card.getByText("Only during opening hours").click();
    await card.getByRole("button", { name: "Save" }).click();
    await expect.poll(read).toBe(false);
    await expect(card.getByRole("button", { name: "Save" })).toBeEnabled();
    await expect(card.getByRole("checkbox", { name: /Only during opening hours/ })).not.toBeChecked();
    await card.getByText("Only during opening hours").click();
    await card.getByRole("button", { name: "Save" }).click();
    await expect.poll(read).toBe(true);
  });
});

test("every admin page opens without errors", async ({ page }) => {
  const noErrors = watchErrors(page);
  for (const path of ["", "/checkin", "/members", "/classes", "/workouts", "/pt", "/foods", "/plans", "/payments", "/settings", `/members/${fx.users.member.memberId}`]) {
    const res = await page.goto(`${admin}${path}`);
    expect(res?.status(), path || "/").toBeLessThan(400);
    await expect(page.locator("h1").first(), path || "/").toBeVisible();
  }
  noErrors();
});
