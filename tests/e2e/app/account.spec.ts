import { sessionCookies } from "../../support/session-cookies";
import { deleteAccount, signedIn, TEST_PASSWORD } from "../../support/test-gym";
import { expect, fx, openApp, service, test, watchErrors } from "../fixture";

// A member deletes their account in the app.
const email = `t${Date.now().toString(36)}.appleaver@gymos.test`;
let userId: string;

test.afterAll(async () => {
  if (userId) await deleteAccount(service, userId);
});

test("a member deletes their account from Profile", async ({ page }) => {
  const noErrors = watchErrors(page);
  const { data, error } = await service.auth.admin.createUser({ email, password: TEST_PASSWORD, email_confirm: true, user_metadata: { full_name: "Ari Leaver" } });
  if (error) throw error;
  userId = data.user.id;
  await service.from("profiles").update({ full_name: "Ari Leaver" }).eq("id", userId);
  await service.from("gym_members").insert({ gym_id: fx.gym.id, user_id: userId, role: "member", status: "active" });
  const { session } = await signedIn(email);
  await page.context().addCookies(await sessionCookies(session));
  await page.addInitScript((slug) => {
    localStorage.setItem("gymos.welcomed", "1");
    localStorage.setItem("gymos.activeGym", slug);
  }, fx.gym.slug);

  await openApp(page);
  await page.getByRole("tab", { name: "Profile" }).click();
  await page.getByRole("button", { name: "Delete account" }).click();
  await page.getByRole("button", { name: "Delete my account" }).click();

  await expect(page.getByRole("tab", { name: "Home" })).toBeHidden({ timeout: 20_000 });
  await expect.poll(async () => (await service.auth.admin.getUserById(userId)).data.user).toBeNull();
  const { data: profile } = await service.from("profiles").select("full_name").eq("id", userId).single();
  expect(profile!.full_name).toBe("Deleted member");
  noErrors();
});
