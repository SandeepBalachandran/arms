import { readFileSync } from "node:fs";
import { test as base, expect, type Page } from "@playwright/test";
import { serviceClient } from "../db/env";
import type { TestRole } from "../support/test-gym";
import { authFile, FIXTURE_FILE, type E2EFixture } from "./paths";

export { expect };

export const fx = JSON.parse(readFileSync(FIXTURE_FILE, "utf8")) as E2EFixture;
export const admin = `/admin/${fx.gym.slug}`;

// For checking results in the database and arranging state only — the action
// under test always goes through the screen.
export const service = serviceClient();

export const test = base;

// Signed in as `role` in the admin or the member app.
export function signedInAs(app: "admin" | "app", role: TestRole) {
  test.use({ storageState: authFile(app, role) });
}

// Fails the test on any uncaught page error (a crash the user would see).
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return () => expect(errors, "page errors").toEqual([]);
}

// The member app on the web: waits past the animated splash.
export async function openApp(page: Page, path = "/") {
  await page.goto(path);
  await page.getByRole("tab", { name: "Home" }).or(page.getByText("Join your gym")).first().waitFor({ timeout: 60_000 });
}

export async function toast(page: Page, text: string | RegExp) {
  await expect(page.getByText(text).first()).toBeVisible();
}
