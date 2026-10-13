import { admin, expect, fx, service, signedInAs, test, watchErrors } from "../fixture";

const overrides = async () => (await service.from("gym_role_permissions").select("role, permission, allowed").eq("gym_id", fx.gym.id)).data;

test.describe("owner", () => {
  signedInAs("admin", "owner");

  test.afterEach(async () => {
    await service.from("gym_role_permissions").delete().eq("gym_id", fx.gym.id);
  });

  test("ticks a permission for a role in the grid, then resets", async ({ page }) => {
    const noErrors = watchErrors(page);
    await page.goto(`${admin}/roles`);
    await expect(page.getByRole("heading", { name: "Roles & permissions" })).toBeVisible();
    await page.getByLabel("Staff: Change plans and prices").locator("xpath=..").click();
    await page.getByLabel("Admin: Turn sections on or off").locator("xpath=..").click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect.poll(overrides).toEqual(expect.arrayContaining([
      { role: "staff", permission: "manage_plans_pricing", allowed: true },
      { role: "admin", permission: "manage_sections", allowed: true },
    ]));
    await page.screenshot({ path: "test-results/roles-grid.png", fullPage: true });

    page.on("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Reset to defaults" }).click();
    await expect.poll(overrides).toEqual([]);
    noErrors();
  });

  test("edits an exercise in a plan inline", async ({ page }) => {
    const noErrors = watchErrors(page);
    await service.from("gyms").update({ workouts_enabled: true }).eq("id", fx.gym.id);
    const { data: plan } = await service.from("workout_plans").insert({ gym_id: fx.gym.id, name: "TEST e2e plan" }).select("id").single();
    const { data: ex } = await service.from("exercises").select("id").is("gym_id", null).eq("name", "Bench Press").single();
    await service.from("workout_plan_items").insert({ plan_id: plan!.id, day_label: "Day A", exercise_id: ex!.id, sets: 3, reps: "8-12", position: 0 });

    await page.goto(`${admin}/workouts/${plan!.id}`);
    await page.getByRole("button", { name: "Edit" }).first().click();
    await page.getByLabel("Sets").first().fill("5");
    await page.getByLabel("Reps").first().fill("5");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("5 × 5")).toBeVisible();
    await page.screenshot({ path: "test-results/plan-edit.png" });
    await service.from("workout_plans").delete().eq("id", plan!.id);
    noErrors();
  });

  test("writes an exercise guide in English and Malayalam", async ({ page }) => {
    const noErrors = watchErrors(page);
    await service.from("gyms").update({ workouts_enabled: true }).eq("id", fx.gym.id);
    const { data: ex } = await service.from("exercises").select("id").is("gym_id", null).eq("name", "Lat Pulldown").single();
    await page.goto(`${admin}/workouts/exercises/${ex!.id}`);
    await page.getByLabel("Video link").fill("https://youtu.be/dQw4w9WgXcQ");
    await expect(page.getByText("YouTube video")).toBeVisible();
    await page.getByLabel("How to do it (English)").fill("Pull the bar to your chest.");
    await page.getByLabel(/Malayalam/).fill("ബാർ നെഞ്ചിലേക്ക് വലിക്കുക.");
    await page.getByRole("button", { name: "Save guide" }).click();
    await expect.poll(async () => (await service.from("exercise_media").select("how_to_ml").eq("gym_id", fx.gym.id).eq("exercise_id", ex!.id).maybeSingle()).data?.how_to_ml).toBe("ബാർ നെഞ്ചിലേക്ക് വലിക്കുക.");
    await page.screenshot({ path: "test-results/exercise-guide.png", fullPage: true });
    await service.from("exercise_media").delete().eq("gym_id", fx.gym.id).eq("exercise_id", ex!.id);
    noErrors();
  });
});

test.describe("admin", () => {
  signedInAs("admin", "admin");

  test("sees settings read-only and no Roles page", async ({ page }) => {
    const noErrors = watchErrors(page);
    expect((await page.goto(`${admin}/roles`))?.status()).toBe(404);
    // Settings open only once the owner grants something.
    await service.from("gym_role_permissions").insert({ gym_id: fx.gym.id, role: "admin", permission: "manage_sections", allowed: true });
    await page.goto(`${admin}/settings`);
    await expect(page.getByText("You can turn sections on or off.")).toBeVisible();
    const profile = page.locator("form", { has: page.locator("input[name=name]") });
    await expect(profile.locator("input[name=name]")).toBeDisabled();
    await page.screenshot({ path: "test-results/settings-admin.png", fullPage: true });
    await service.from("gym_role_permissions").delete().eq("gym_id", fx.gym.id);
    noErrors();
  });

  test("without a grant, settings aren't there", async ({ page }) => {
    expect((await page.goto(`${admin}/settings`))?.status()).toBe(404);
    await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
  });
});
