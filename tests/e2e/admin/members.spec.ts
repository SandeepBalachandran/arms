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

test("open the receipt from the Payments page and print it", async ({ page }) => {
  const noErrors = watchErrors(page);
  // A paid Monthly membership for this member (also made by the payment test above).
  const sub = await service.from("subscriptions").insert({ gym_id: fx.gym.id, member_id: fx.users.member2.memberId!, plan_id: fx.planId, plan_name: "Monthly", price_paise: 150000, starts_on: "2026-01-01", ends_on: "2026-01-30" }).select("id").single();
  await service.from("payments").insert({ gym_id: fx.gym.id, member_id: fx.users.member2.memberId!, subscription_id: sub.data!.id, plan_id: fx.planId, amount_paise: 150000, method: "cash", status: "paid", paid_at: new Date().toISOString() });
  await page.goto(`${admin}/payments`);
  const row = page.locator("tr").filter({ hasText: fx.users.member2.name }).first();
  await row.getByRole("link", { name: /^#\d+$/ }).click();

  const receipt = page.getByRole("article", { name: /Receipt #\d+/ });
  await expect(receipt).toBeVisible();
  await expect(receipt.getByText("Membership: Monthly")).toBeVisible();
  await expect(receipt.getByText(fx.users.member2.name)).toBeVisible();
  await expect(receipt.getByText("₹1,500")).toBeVisible();
  await expect(page.getByRole("button", { name: "Print / Save PDF" })).toBeVisible();

  // When printed, only the receipt shows.
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("navigation", { name: "Admin" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Print / Save PDF" })).toBeHidden();
  await expect(receipt).toBeVisible();
  noErrors();
});

// A 1×1 PNG: the browser crops and shrinks it to a 400 px JPEG before upload.
const png = { name: "face.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64") };

test("front desk adds a member's photo, and it shows in the members list", async ({ page }) => {
  const noErrors = watchErrors(page);
  const userId = fx.users.member2.id;
  await page.goto(`${admin}/members/${fx.users.member2.memberId}`);
  await page.getByRole("button", { name: /^Add .+'s photo$/ }).click();
  await page.getByRole("dialog").getByLabel("Photo file").setInputFiles(png);
  await expect(page.getByText("Photo saved")).toBeVisible();

  const { data } = await service.from("profiles").select("avatar_url").eq("id", userId).single();
  expect(data!.avatar_url).toMatch(/^[0-9a-f-]{36}\/\d+\.jpg$/);
  expect(data!.avatar_url!.startsWith(`${userId}/`)).toBe(true);
  await expect(page.getByRole("button", { name: /^Change .+'s photo$/ }).locator("img")).toBeVisible();

  await page.goto(`${admin}/members`);
  const row = page.locator("tr").filter({ hasText: fx.users.member2.name }).first();
  await expect(row.locator("img")).toHaveAttribute("src", /\/object\/sign\/avatars\//);
  noErrors();
});

test("front desk can't change a trainer's photo", async ({ page }) => {
  await page.goto(`${admin}/members/${fx.users.trainer.memberId}`);
  await expect(page.getByRole("heading", { name: fx.users.trainer.name })).toBeVisible();
  await expect(page.getByRole("button", { name: /photo$/ })).toHaveCount(0);
});

test("an iPhone (HEIC) photo is converted and replaces the old one", async ({ page }) => {
  const noErrors = watchErrors(page);
  const userId = fx.users.member2.id;
  const before = (await service.from("profiles").select("avatar_url").eq("id", userId).single()).data!.avatar_url;
  await page.goto(`${admin}/members/${fx.users.member2.memberId}`);
  await page.getByRole("button", { name: /photo$/ }).click();
  await page.getByRole("dialog").getByLabel("Photo file").setInputFiles("tests/e2e/files/face.heic");
  await expect(page.getByText("Photo saved")).toBeVisible({ timeout: 30_000 });

  const after = (await service.from("profiles").select("avatar_url").eq("id", userId).single()).data!.avatar_url;
  expect(after).toMatch(/\.jpg$/);
  expect(after).not.toBe(before);
  const { data: files } = await service.storage.from("avatars").list(userId);
  expect(files?.map((f) => `${userId}/${f.name}`)).toEqual([after]);
  noErrors();
});
