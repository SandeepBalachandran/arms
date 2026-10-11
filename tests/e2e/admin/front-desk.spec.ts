import { admin, expect, fx, service, signedInAs, test, watchErrors } from "../fixture";

signedInAs("admin", "staff");

test("check a member in by name", async ({ page }) => {
  const noErrors = watchErrors(page);
  await page.goto(`${admin}/checkin`);
  await page.getByPlaceholder("Member name").fill("Maya");
  await page.getByPlaceholder("Member name").press("Enter");
  const row = page.locator("li, tr, div").filter({ hasText: fx.users.member.name }).filter({ has: page.getByRole("button", { name: "Check in" }) }).last();
  await row.getByRole("button", { name: "Check in" }).click();
  await expect(page.getByText(/Checked in/).first()).toBeVisible();
  // The full result, with the photo (or a nudge to add one), across the row.
  await expect(page.getByText(/^(Checked in at|Already checked in at) /).first()).toBeVisible();
  await expect(page.getByText(/No photo yet|Membership|membership/).first()).toBeVisible();

  const { count } = await service.from("checkins").select("*", { count: "exact", head: true }).eq("member_id", fx.users.member.memberId!);
  expect(count).toBeGreaterThan(0);
  noErrors();
});

test("import members by pasting from a spreadsheet", async ({ page }) => {
  const noErrors = watchErrors(page);
  await page.goto(`${admin}/members/import`);
  const rows = [
    "Name\tPhone\tPlan\tLast paid on\tPaid until\tAmount",
    "Imported Isha\t9811100001\tMonthly\t01/10/2026\t31/10/2026\t1500",
    "Imported Ivan\t9811100002\t\t\t\t",
  ].join("\n");
  await page.locator("textarea").fill(rows);
  await page.getByRole("button", { name: "Check pasted rows" }).click();
  await expect(page.getByText("2 ready")).toBeVisible();
  await page.getByRole("button", { name: "Import 2 members" }).click();
  await expect(page.getByText("2 members added")).toBeVisible({ timeout: 30_000 });

  const { data } = await service.from("profiles").select("full_name").in("full_name", ["Imported Isha", "Imported Ivan"]);
  expect(data).toHaveLength(2);
  noErrors();
});

test("the import preview flags problems before anything is saved", async ({ page }) => {
  await page.goto(`${admin}/members/import`);
  await page.locator("textarea").fill("Name\tPhone\tPlan\tLast paid on\nBad Plan\t9811100003\tPlatinum\t01/10/2026");
  await page.getByRole("button", { name: "Check pasted rows" }).click();
  await expect(page.getByText(/No plan called "Platinum"/)).toBeVisible();
});
