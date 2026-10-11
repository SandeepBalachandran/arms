import type { Session } from "@supabase/supabase-js";
import { anonClient, serviceClient, type Db } from "../db/env";

// A throwaway gym ("test-<run>") with one fresh account per role. Used by the
// database tests and the browser tests; never touches any other gym or account.

export const ROLES = ["owner", "admin", "staff", "trainer", "member", "member2", "outsider"] as const;
export type TestRole = (typeof ROLES)[number];

export const TEST_PASSWORD = "Test-only-Passw0rd!";
const TEST_EMAIL = /^t[a-z0-9]+\.[a-z0-9]+@gymos\.test$/;
const STALE_MS = 2 * 60 * 60 * 1000;

export type TestUser = { id: string; email: string; name: string; session: Session; memberId: string | null };

export type TestGym = {
  run: string;
  gym: { id: string; slug: string; name: string };
  planId: string;
  users: Record<TestRole, TestUser>;
};

const NAMES: Record<TestRole, string> = {
  owner: "Olivia Owner",
  admin: "Arun Admin",
  staff: "Sana Staff",
  trainer: "Tom Trainer",
  member: "Maya Member",
  member2: "Manu Member",
  outsider: "Omar Outsider",
};

async function signedIn(email: string) {
  const client = anonClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (error) throw error;
  return { client, session: data.session };
}

export async function createTestGym(): Promise<TestGym> {
  const admin = serviceClient();
  await sweepLeftovers(admin);

  const run = Date.now().toString(36);
  const slug = `test-${run}`;
  const name = `Test Gym ${run}`;
  const users = {} as TestGym["users"];
  const clients = {} as Record<TestRole, Db>;

  for (const role of ROLES) {
    const email = `t${run}.${role}@gymos.test`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: NAMES[role] },
    });
    if (error) throw error;
    await admin.from("profiles").update({ full_name: NAMES[role] }).eq("id", data.user.id);
    const { client, session } = await signedIn(email);
    clients[role] = client;
    users[role] = { id: data.user.id, email, name: NAMES[role], session, memberId: null };
  }

  const { data: gymId, error: gymError } = await clients.owner.rpc("register_gym", { p_name: name, p_slug: slug });
  if (gymError) throw gymError;

  // Everyone except the outsider joins; team roles are then set directly.
  for (const role of ROLES.filter((r) => r !== "owner" && r !== "outsider")) {
    const { error } = await clients[role].rpc("join_gym", { p_slug: slug });
    if (error) throw error;
  }
  for (const role of ["admin", "staff", "trainer"] as const) {
    const { error } = await admin.from("gym_members").update({ role, status: "active" }).eq("gym_id", gymId).eq("user_id", users[role].id);
    if (error) throw error;
  }
  const { data: members, error: membersError } = await admin.from("gym_members").select("id, user_id").eq("gym_id", gymId);
  if (membersError) throw membersError;
  for (const role of ROLES) users[role].memberId = members.find((m) => m.user_id === users[role].id)?.id ?? null;

  const { data: plan, error: planError } = await admin
    .from("plans")
    .insert({ gym_id: gymId, name: "Monthly", price_paise: 150000, duration_days: 30 })
    .select("id")
    .single();
  if (planError) throw planError;

  return { run, gym: { id: gymId, slug, name }, planId: plan.id, users };
}

export async function removeTestGym(t: Pick<TestGym, "run" | "gym" | "users">) {
  const admin = serviceClient();
  const extra = await accountsMadeDuringRun(admin, t);
  await removeGymsLike(admin, t.gym.slug);
  for (const id of [...Object.values(t.users).map((u) => u.id), ...extra]) await admin.auth.admin.deleteUser(id);
}

// Accounts the tests created through the app (e.g. "Add member", import):
// members of the test gym, created after the run started, in no other gym.
async function accountsMadeDuringRun(admin: Db, t: Pick<TestGym, "run" | "gym" | "users">) {
  const started = new Date(parseInt(t.run, 36)).toISOString();
  const known = new Set(Object.values(t.users).map((u) => u.id));
  const { data: rows } = await admin.from("gym_members").select("user_id, gyms!inner(slug)").like("gyms.slug", `${t.gym.slug}%`);
  const ids: string[] = [];
  for (const userId of new Set((rows ?? []).map((r) => r.user_id))) {
    if (known.has(userId)) continue;
    const { data: user } = await admin.auth.admin.getUserById(userId);
    if (!user.user || user.user.created_at < started) continue;
    const { data: other } = await admin.from("gym_members").select("id, gyms!inner(slug)").eq("user_id", userId).not("gyms.slug", "like", `${t.gym.slug}%`);
    if (!other?.length) ids.push(userId);
  }
  return ids;
}

// The test gym plus any extra gyms a test made with the same prefix.
async function removeGymsLike(admin: Db, slug: string) {
  const { data } = await admin.from("gyms").select("id").like("slug", `${slug}%`);
  for (const g of data ?? []) {
    const { error } = await admin.from("gyms").delete().eq("id", g.id);
    if (error) console.warn(`Could not remove test gym ${g.id}: ${error.message}`);
  }
}

// Gyms and accounts left by earlier runs that didn't finish (older than 2 h).
async function sweepLeftovers(admin: Db) {
  const cutoff = new Date(Date.now() - STALE_MS).toISOString();
  const { data: gyms } = await admin.from("gyms").select("id").like("slug", "test-%").lt("created_at", cutoff);
  for (const g of gyms ?? []) await admin.from("gyms").delete().eq("id", g.id);

  for (let page = 1; page < 20; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const users = data?.users ?? [];
    for (const u of users) {
      if (u.email && TEST_EMAIL.test(u.email) && u.created_at < cutoff) await admin.auth.admin.deleteUser(u.id);
    }
    if (users.length < 200) break;
  }
}
