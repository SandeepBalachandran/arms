import type { TestProject } from "vitest/node";
import { createTestGym, removeTestGym, type TestRole } from "../support/test-gym";

// Creates the throwaway gym and accounts (tests/support/test-gym.ts) once,
// hands their sessions to the tests, and removes everything afterwards.

export type { TestRole };

export type Fixture = {
  run: string;
  gym: { id: string; slug: string; name: string };
  planId: string;
  users: Record<TestRole, { id: string; email: string; token: string; memberId: string | null }>;
};

declare module "vitest" {
  export interface ProvidedContext {
    fixture: Fixture;
  }
}

export default async function setup(project: TestProject) {
  const t = await createTestGym();
  const users = Object.fromEntries(
    Object.entries(t.users).map(([role, u]) => [role, { id: u.id, email: u.email, token: u.session.access_token, memberId: u.memberId }]),
  ) as Fixture["users"];
  project.provide("fixture", { run: t.run, gym: t.gym, planId: t.planId, users });
  return () => removeTestGym(t);
}
