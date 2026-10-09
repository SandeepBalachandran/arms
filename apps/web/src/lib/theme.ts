import "server-only";
import { cookies } from "next/headers";

export type Theme = "light" | "dark";
export const THEME_COOKIE = "theme";

// The user's chosen theme; light unless they picked dark.
export async function getTheme(): Promise<Theme> {
  return (await cookies()).get(THEME_COOKIE)?.value === "dark" ? "dark" : "light";
}
