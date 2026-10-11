import { readFileSync, rmSync } from "node:fs";
import { removeTestGym } from "../support/test-gym";
import { AUTH_DIR, FIXTURE_FILE, type E2EFixture } from "./paths";

export default async function globalTeardown() {
  const fixture = JSON.parse(readFileSync(FIXTURE_FILE, "utf8")) as E2EFixture;
  await removeTestGym(fixture);
  rmSync(AUTH_DIR, { recursive: true, force: true });
}
