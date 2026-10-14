// Which side of GOS someone last chose: "admin" (run the gym) or "member" (use
// the gym like a member). Matters only to people on a gym's team, who can do
// both. Plain cookie so the member app (apps/mobile, web build) can read it.
export const VIEW_COOKIE = "gos_view";
export type View = "admin" | "member";

export const viewCookieOptions = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" as const };
