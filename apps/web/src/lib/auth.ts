import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { highestRole, shownEmail, type Database, type GymRole, type Permission } from "@gymos/shared";

export { STAFF_ROLES, TEAM_ROLES, type GymRole, type Permission } from "@gymos/shared";

export type CurrentUser = {
  id: string;
  email: string | null;
  fullName: string;
  // Storage path of their profile photo (see lib/avatars), or null.
  avatarPath: string | null;
  isPlatformAdmin: boolean;
};

export type GymMembership = {
  memberId: string;
  // Their highest role (main or extra), as the database's auth_role_in()
  // sees it, so role checks include extra roles.
  role: GymRole;
  // Main role first, then any extra roles (e.g. an owner who also trains).
  roles: GymRole[];
  // The whole gym row, including its settings.
  gym: Database["public"]["Tables"]["gyms"]["Row"];
};

// The signed-in user with their profile, or null. Cached per request.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, is_platform_admin")
    .eq("id", claims.sub)
    .single();

  return {
    id: claims.sub,
    // A phone + PIN member's placeholder address is never shown.
    email: shownEmail(claims.email as string | undefined),
    fullName: profile?.full_name ?? "",
    avatarPath: profile?.avatar_url ?? null,
    isPlatformAdmin: profile?.is_platform_admin ?? false,
  };
});

// Redirects to the login page when nobody is signed in.
export async function requireUser(next: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

// The developers' view (/platform): only accounts with profiles.is_platform_admin.
// The database checks the same flag in every platform_* function.
export async function requirePlatformAdmin(next = "/platform") {
  const user = await requireUser(next);
  if (!user.isPlatformAdmin) notFound();
  return user;
}

// Every active gym the user belongs to, with their role in it.
export const getMyGyms = cache(async (): Promise<GymMembership[]> => {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("gym_members")
    .select("id, role, extra_roles, gyms!inner(*)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .eq("gyms.status", "active")
    .order("joined_at");

  return (data ?? []).map((row) => {
    const roles = [row.role, ...row.extra_roles];
    return { memberId: row.id, role: highestRole(roles), roles, gym: row.gyms };
  });
});

// What the signed-in user may do in a gym (the owner's grid, see
// has_permission in the database). Cached per request.
export const getMyPermissions = cache(async (gymId: string): Promise<Set<Permission>> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_permissions", { p_gym_id: gymId });
  if (error) throw error;
  return new Set(data as Permission[]);
});

// Resolves a gym by slug for the signed-in user, enforcing a role. Use at the
// top of every admin page and inside every server action.
export async function requireGym(slug: string, roles: GymRole[], next = `/admin/${slug}`) {
  const user = await requireUser(next);
  const membership = (await getMyGyms()).find((m) => m.gym.slug === slug);
  if (!membership || !roles.includes(membership.role)) notFound();
  const permissions = await getMyPermissions(membership.gym.id);
  return { user, ...membership, permissions, can: (permission: Permission) => permissions.has(permission) };
}

// Like requireGym, for an action the owner's grid controls. The database
// checks the same permission, so this is for a clear "not found" and for
// hiding pages, not the only guard.
export async function requirePermission(slug: string, permission: Permission, next = `/admin/${slug}`) {
  const gym = await requireGym(slug, ["owner", "admin", "staff", "trainer", "member"], next);
  if (!gym.can(permission)) notFound();
  return gym;
}

// Only allow redirects to paths on this site, never to another domain.
export function safeNextPath(next: string | null | undefined, fallback = "/") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
