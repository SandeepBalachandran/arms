import path from "node:path";
import type { TestGym, TestRole } from "../support/test-gym";

export const AUTH_DIR = path.join("tests", "e2e", ".auth");
export const FIXTURE_FILE = path.join(AUTH_DIR, "fixture.json");

export type E2EFixture = TestGym & { ptPackageId: string; workoutPlanId: string };

export function authFile(app: "admin" | "app", role: TestRole) {
  return path.join(AUTH_DIR, `${app}-${role}.json`);
}
