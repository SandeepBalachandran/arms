import { admin, expect, fx, service, signedInAs, test, watchErrors } from "../fixture";

signedInAs("admin", "staff");

test("front desk adds a member", async ({ page }) => {
  const noErrors = watchErrors(page);
  await page.goto(`${admin}/members`);
  await page.getByRole("button", { name: /Add member/i }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Full name").fill("Walk-in Wilson");
  await dialog.getByLabel("Phone").fill("9876501234");
  await dialog.getByRole("button", { name: /Add/ }).click();
  await expect(page.getByText("Walk-in Wilson").first()).toBeVisible();
  noErrors();
});

test("front desk records a cash payment and the membership starts", async ({ page }) => {
  const noErrors = watchErrors(page);
  await page.goto(`${admin}/members/${fx.users.member2.memberId}`);
  await page.getByRole("button", { name: "Record payment" }).click();
  const form = page.getByRole("dialog");
  await form.getByLabel("Plan").selectOption(fx.planId);
  await form.getByLabel("Method").selectOption("cash");
  await form.getByRole("button", { name: /Record|Save/i }).click();
  await expect(form).toBeHidden();

  const { data } = await service.from("subscriptions").select("plan_name, status").eq("member_id", fx.users.member2.memberId!);
  expect(data).toEqual(expect.arrayContaining([{ plan_name: "Monthly", status: "active" }]));
  await page.reload();
  await expect(page.getByText(/Monthly/).first()).toBeVisible();
  noErrors();
});

test("search finds a member by name", async ({ page }) => {
  await page.goto(`${admin}/members`);
  await page.getByPlaceholder("Search by name").fill("Manu");
  await page.getByPlaceholder("Search by name").press("Enter");
  await expect(page.getByText(fx.users.member2.name).first()).toBeVisible();
  await expect(page.getByText(fx.users.member.name)).toHaveCount(0);
});
