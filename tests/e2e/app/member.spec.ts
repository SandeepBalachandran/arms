import { expect, fx, openApp, service, signedInAs, test, watchErrors } from "../fixture";

// The member app (Expo, running in the browser) as a member with a PT
// package, an assigned workout plan and a class tomorrow.
signedInAs("app", "member");

test("home shows the gym, and the member checks in", async ({ page }) => {
  const noErrors = watchErrors(page);
  // The admin tests check this member in at the desk; start from no visit today.
  await service.from("checkins").delete().eq("member_id", fx.users.member.memberId!);
  await openApp(page);
  await expect(page.getByText(fx.gym.name).filter({ visible: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Check in", exact: true }).click();
  await expect(page.getByText(/Checked in at/).filter({ visible: true }).first()).toBeVisible();

  const { count } = await service.from("checkins").select("*", { count: "exact", head: true }).eq("member_id", fx.users.member.memberId!).eq("method", "self");
  expect(count).toBe(1);
  noErrors();
});

test("book tomorrow's class, then cancel it with the in-app popup", async ({ page }) => {
  const noErrors = watchErrors(page);
  await openApp(page);
  await page.getByRole("tab", { name: "Classes" }).click();
  await expect(page.getByText("Yoga").filter({ visible: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Book a spot" }).first().click();
  await expect(page.getByText("Booked ✓").filter({ visible: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Cancel booking" }).first().click();
  await page.getByRole("button", { name: "Cancel your spot" }).click();
  await expect(page.getByRole("button", { name: "Book a spot" }).first()).toBeVisible();

  const { data } = await service.from("class_bookings").select("status").eq("member_id", fx.users.member.memberId!);
  expect(data!.map((b) => b.status)).toEqual(["cancelled"]);
  noErrors();
});

test("log a workout from the trainer's plan", async ({ page }) => {
  const noErrors = watchErrors(page);
  await openApp(page);
  await page.getByRole("tab", { name: "Workouts" }).click();
  await expect(page.getByText("Day 1 · Upper").filter({ visible: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Start workout" }).click();

  await page.getByLabel("Set 1 weight in kg").first().fill("40");
  await page.getByLabel("Set 1 reps").first().fill("10");
  await page.getByRole("checkbox", { name: "Set 1 done" }).first().click();
  await expect(page.getByText("REST").filter({ visible: true }).first()).toBeVisible();
  await page.getByRole("button", { name: /Finish workout · 1 set/ }).click();
  await expect(page.getByText("Workout saved!").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText("400").filter({ visible: true }).first()).toBeVisible(); // kg lifted: 40 × 10

  const { data } = await service.from("workout_logs").select("day_label, workout_log_sets(reps, weight_kg)").eq("member_id", fx.users.member.memberId!);
  expect(data).toEqual([{ day_label: "Day 1 · Upper", workout_log_sets: [{ reps: 10, weight_kg: 40 }] }]);
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("1 workout this week. Keep it up!").filter({ visible: true }).first()).toBeVisible();
  noErrors();
});

test("set up nutrition and log breakfast", async ({ page }) => {
  const noErrors = watchErrors(page);
  await openApp(page);
  await page.getByRole("tab", { name: "Food" }).click();
  await page.getByRole("button", { name: "Get started" }).click();

  await page.getByLabel("Height (cm)").fill("170");
  await page.getByLabel("Weight (kg)").fill("70");
  await page.getByLabel("Birth year").fill("1995");
  await page.getByRole("radio", { name: "Female" }).click();
  await page.getByRole("radio", { name: "Veg", exact: true }).click();
  await page.getByRole("button", { name: "Start tracking" }).click();

  await page.getByRole("button", { name: "Add to Breakfast" }).click();
  await page.getByPlaceholder(/Search/).fill("puttu");
  await page.getByText("Puttu", { exact: true }).filter({ visible: true }).first().click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Puttu").filter({ visible: true }).first()).toBeVisible();

  const { data } = await service.from("food_logs").select("name, meal").eq("member_id", fx.users.member.memberId!);
  expect(data).toEqual([{ name: "Puttu", meal: "breakfast" }]);
  noErrors();
});

test("open a receipt from Membership", async ({ page }) => {
  const noErrors = watchErrors(page);
  await openApp(page);
  await page.getByRole("tab", { name: "Membership" }).click();
  // The PT package sold at the desk during setup.
  await page.getByRole("button", { name: /^Receipt #\d+, ₹6,000$/ }).click();
  await expect(page.getByText("Personal training: 12 PT sessions").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText("12 sessions").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText(fx.users.member.name).filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Print or save as PDF" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send on WhatsApp" })).toBeVisible();
  noErrors();
});

// A 1×1 PNG: the app crops and shrinks it to a 400 px JPEG before upload.
const png = { name: "me.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64") };

test("add a profile photo from the gallery", async ({ page }) => {
  const noErrors = watchErrors(page);
  const userId = fx.users.member.id;
  await openApp(page);
  await page.getByRole("tab", { name: "Profile" }).click();
  await page.getByRole("button", { name: "Add your photo" }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose from gallery" }).click();
  await (await chooser).setFiles(png);

  await expect(page.getByRole("button", { name: "Change your photo" })).toBeVisible();
  const { data } = await service.from("profiles").select("avatar_url").eq("id", userId).single();
  expect(data!.avatar_url).toMatch(/^[0-9a-f-]{36}\/\d+\.jpg$/);
  expect(data!.avatar_url!.startsWith(`${userId}/`)).toBe(true);
  const { data: files } = await service.storage.from("avatars").list(userId);
  expect(files).toHaveLength(1);
  noErrors();
});

test("every tab opens without errors", async ({ page }) => {
  const noErrors = watchErrors(page);
  await openApp(page);
  for (const tab of ["Classes", "Workouts", "Food", "Membership", "Profile", "Home"]) {
    await page.getByRole("tab", { name: tab }).click();
    await page.waitForTimeout(800);
  }
  noErrors();
});
