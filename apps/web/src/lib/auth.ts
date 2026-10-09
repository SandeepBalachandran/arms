import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { GymRole } from "@gymos/shared";

export { STAFF_ROLES, TEAM_ROLES, type GymRole } from "@gymos/shared";

export type CurrentUser = {
  id: string;
  email: string | null;
  fullName: string;
  isPlatformAdmin: boolean;
};

export type GymMembership = {
  memberId: string;
  role: GymRole;
  gym: {
    id: string;
    slug: string;
    name: string;
    logo_url: string | null;
    timezone: string;
    currency: string;
    checkin_enabled: boolean;
    classes_enabled: boolean;
    workouts_enabled: boolean;
  };
};

// The signed-in user with their profile, or null. Cached per request.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, is_platform_admin")
    .eq("id", claims.sub)
    .single();

  return {
    id: claims.sub,
    email: (claims.email as string | undefined) ?? null,
    fullName: profile?.full_name ?? "",
    isPlatformAdmin: profile?.is_platform_admin ?? false,
  };
});

// Redirects to the login page when nobody is signed in.
export async function requireUser(next: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

// Every active gym the user belongs to, with their role in it.
export const getMyGyms = cache(async (): Promise<GymMembership[]> => {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("gym_members")
    .select("id, role, gyms!inner(id, slug, name, logo_url, timezone, currency, checkin_enabled, classes_enabled, workouts_enabled, status)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .eq("gyms.status", "active")
    .order("joined_at");

  return (data ?? []).map((row) => ({
    memberId: row.id,
    role: row.role,
    gym: row.gyms,
  }));
});

// Resolves a gym by slug for the signed-in user, enforcing a role. Use at the
// top of every admin page and inside every server action.
export async function requireGym(slug: string, roles: GymRole[], next = `/admin/${slug}`) {
  const user = await requireUser(next);
  const membership = (await getMyGyms()).find((m) => m.gym.slug === slug);
  if (!membership || !roles.includes(membership.role)) notFound();
  return { user, ...membership };
}

// Only allow redirects to paths on this site, never to another domain.
export function safeNextPath(next: string | null | undefined, fallback = "/") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
