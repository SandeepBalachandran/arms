import { TEST_PASSWORD } from "../../support/test-gym";
import { admin, expect, fx, test, watchErrors } from "../fixture";

test("owner signs in with a password and lands on their gym", async ({ page }) => {
  const noErrors = watchErrors(page);
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(fx.users.owner.email);
  await page.locator("input[name=password]").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${admin}$`));
  await expect(page.getByText(fx.gym.name).first()).toBeVisible();
  noErrors();
});

test("a wrong password shows a clear message", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(fx.users.owner.email);
  await page.locator("input[name=password]").fill("wrong-password-1");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert").last()).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("admin pages need signing in", async ({ page }) => {
  await page.goto(admin);
  await expect(page).toHaveURL(/\/login/);
});
