import { inject } from "vitest";
import { clientWithToken, serviceClient, type Db } from "./env";
import type { TestRole } from "./setup";

export const fx = inject("fixture");

// One client per role, acting as that signed-in user.
export const as: Record<TestRole, Db> = Object.fromEntries(
  Object.entries(fx.users).map(([role, u]) => [role, clientWithToken(u.token)]),
) as Record<TestRole, Db>;

export const memberId = (role: TestRole) => fx.users[role].memberId!;

// For arranging test state (e.g. gym settings) only — never for the action
// being tested.
export const service = serviceClient();

export async function setGym(patch: Parameters<ReturnType<Db["from"]>["update"]>[0]) {
  const { error } = await service.from("gyms").update(patch as never).eq("id", fx.gym.id);
  if (error) throw error;
}

// Expect a Supabase call to be refused, either with an error or by RLS
// silently returning/affecting no rows.
export function refused(res: { error: unknown; data?: unknown }) {
  if (res.error) return true;
  return Array.isArray(res.data) ? res.data.length === 0 : res.data == null;
}

export { HOURS_ALWAYS, hoursClosedNow } from "./fixture-data";
