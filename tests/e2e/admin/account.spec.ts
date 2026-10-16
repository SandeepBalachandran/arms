import { deleteAccount, TEST_PASSWORD } from "../../support/test-gym";
import { expect, fx, service, test, watchErrors } from "../fixture";
import { authFile } from "../paths";

// A member deletes their account on the web. (Not signed in to start with.)
const email = `t${Date.now().toString(36)}.leaver@gymos.test`;
let userId: string;

test.beforeAll(async () => {
  const { data, error } = await service.auth.admin.createUser({ email, password: TEST_PASSWORD, email_confirm: true, user_metadata: { full_name: "Lena Leaver" } });
  if (error) throw error;
  userId = data.user.id;
  await service.from("profiles").update({ full_name: "Lena Leaver" }).eq("id", userId);
  await service.from("gym_members").insert({ gym_id: fx.gym.id, user_id: userId, role: "member", status: "active" });
});

test.afterAll(async () => {
  if (userId) await deleteAccount(service, userId);
});

test.describe("as the owner", () => {
  test.use({ storageState: authFile("admin", "owner") });

  test("a gym owner is told to delete the gym first", async ({ page }) => {
    await page.goto(`/admin/${fx.gym.slug}/profile`);
    await page.getByRole("button", { name: "Delete my account" }).click();
    await page.getByRole("dialog").getByRole("textbox").fill("DELETE");
    await page.getByRole("dialog").getByRole("button", { name: "Delete my account" }).click();
    await expect(page.getByText(/You own .+\. Delete the gym in Settings first/)).toBeVisible();
    expect((await service.auth.admin.getUserById(fx.users.owner.id)).data.user).toBeTruthy();
  });
});

test("a member deletes their account", async ({ page }) => {
  const noErrors = watchErrors(page);
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.locator("input[name=password]").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  // Members land in the member app (/go sends them on to /app); wait until they're there.
  await page.waitForURL((url) => url.pathname.startsWith("/app"), { waitUntil: "load" });

  await page.goto("/account");
  await page.getByRole("button", { name: "Delete my account" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Delete my account" })).toBeDisabled();
  await dialog.getByRole("textbox").fill("delete");
  await dialog.getByRole("button", { name: "Delete my account" }).click();

  await expect(page).toHaveURL(/\/login\?deleted=1/);
  await expect(page.getByText("Your account has been deleted.")).toBeVisible();
  expect((await service.auth.admin.getUserById(userId)).data.user).toBeNull();
  const { data } = await service.from("profiles").select("full_name").eq("id", userId).single();
  expect(data!.full_name).toBe("Deleted member");
  noErrors();
});
