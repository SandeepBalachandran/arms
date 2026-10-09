import { z } from "zod";
import type { Database } from "./database.types";

// Shared by the web admin and the mobile app.

export type GymRole = Database["public"]["Enums"]["gym_role"];

export const TEAM_ROLES: GymRole[] = ["owner", "admin", "staff", "trainer"];
export const STAFF_ROLES: GymRole[] = ["owner", "admin", "staff"];

// A gym's slug doubles as the "gym code" members type in the app.
// Mirrors the check constraint on public.gyms.slug.
export const gymSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9](-?[a-z0-9])*$/, "Use lowercase letters, numbers and single dashes")
  .min(3, "Gym code must be at least 3 characters")
  .max(40);

// Pulls a gym slug out of a pasted join link or a typed code.
// "https://gymos.app/join/iron-fit?x=1" and " Iron-Fit " both give "iron-fit".
export function parseGymCode(input: string): string | null {
  const match = input.match(/\/join\/([^/?#\s]+)/);
  const parsed = gymSlugSchema.safeParse(match ? match[1] : input);
  return parsed.success ? parsed.data : null;
}
