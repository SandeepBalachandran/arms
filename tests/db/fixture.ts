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

// Open all day, every day.
export const HOURS_ALWAYS = Object.fromEntries(
  ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => [d, { morning: ["00:00", "23:59"] }]),
);
// One short session six hours from now (gym time zone is Asia/Kolkata), so the
// gym is closed now even counting the 15 minutes' early check-in.
export function hoursClosedNow() {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  const start = (hour + 6) % 24;
  const pad = (n: number) => String(n).padStart(2, "0");
  return Object.fromEntries(
    ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => [d, { morning: [`${pad(start)}:00`, `${pad(start)}:30`] }]),
  );
}
