import { expect, fx, openApp, service, signedInAs, test, watchErrors } from "../fixture";

test.describe("someone new", () => {
  signedInAs("app", "outsider");

  test("joins the gym with its code", async ({ page }) => {
    const noErrors = watchErrors(page);
    await openApp(page);
    await expect(page.getByText("Join your gym").filter({ visible: true }).first()).toBeVisible();
    await page.getByPlaceholder("e.g. iron-fit").fill(fx.gym.slug);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText(fx.gym.name).filter({ visible: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Join gym" }).click();
    await page.getByRole("button", { name: `Open ${fx.gym.name}` }).or(page.getByRole("tab", { name: "Home" })).first().click();
    await expect(page.getByRole("tab", { name: "Home" })).toBeVisible();

    const { data } = await service.from("gym_members").select("status").eq("gym_id", fx.gym.id).eq("user_id", fx.users.outsider.id).single();
    expect(data!.status).toBe("active");
    noErrors();
  });
});

test.describe("a member without a plan", () => {
  signedInAs("app", "member2");

  test("pays by UPI and waits for the gym to confirm", async ({ page }) => {
    const noErrors = watchErrors(page);
    await openApp(page);
    await page.getByRole("tab", { name: "Membership" }).click();
    await page.getByRole("button", { name: /Pay ₹1,500 with UPI/ }).first().click();
    await expect(page.getByText(/testgym@okhdfcbank|arms\.fitness@okhdfcbank/).filter({ visible: true }).first()).toBeVisible();
    await page.getByLabel("UPI reference number (optional)").fill("123456789012");
    await page.getByRole("button", { name: "I’ve paid" }).click();
    await expect(page.getByText(/Payment not confirmed|waiting/i).filter({ visible: true }).first()).toBeVisible();

    const { data } = await service.from("payments").select("status, utr, amount_paise").eq("member_id", fx.users.member2.memberId!).eq("method", "upi");
    expect(data).toEqual([{ status: "created", utr: "123456789012", amount_paise: 150000 }]);
    noErrors();
  });
});
