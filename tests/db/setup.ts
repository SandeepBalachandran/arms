import type { TestProject } from "vitest/node";
import { anonClient, serviceClient } from "./env";

// Creates a throwaway gym ("test-<run>") with one fresh account per role,
// signs each in once, and hands the sessions to the tests. Everything is
// deleted afterwards, plus leftovers from runs that crashed. Never touches
// any other gym or account.

export const ROLES = ["owner", "admin", "staff", "trainer", "member", "member2", "outsider"] as const;
export type TestRole = (typeof ROLES)[number];

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

const PASSWORD = "Test-only-Passw0rd!";
const TEST_EMAIL = /^t[a-z0-9]+\.[a-z0-9]+@gymos\.test$/;
const STALE_MS = 2 * 60 * 60 * 1000;

export default async function setup(project: TestProject) {
  const admin = serviceClient();
  await sweepLeftovers(admin);

  const run = Date.now().toString(36);
  const slug = `test-${run}`;
  const users = {} as Fixture["users"];

  for (const role of ROLES) {
    const email = `t${run}.${role}@gymos.test`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: `Test ${role}` },
    });
    if (error) throw error;
    const client = anonClient();
    const signIn = await client.auth.signInWithPassword({ email, password: PASSWORD });
    if (signIn.error) throw signIn.error;
    users[role] = { id: data.user.id, email, token: signIn.data.session.access_token, memberId: null };
  }

  const owner = anonClient();
  await owner.auth.signInWithPassword({ email: users.owner.email, password: PASSWORD });
  const { data: gymId, error: gymError } = await owner.rpc("register_gym", { p_name: `Test Gym ${run}`, p_slug: slug });
  if (gymError) throw gymError;

  // Everyone except the outsider joins; team roles are then set directly.
  for (const role of ROLES.filter((r) => r !== "owner" && r !== "outsider")) {
    const client = anonClient();
    await client.auth.signInWithPassword({ email: users[role].email, password: PASSWORD });
    const { error } = await client.rpc("join_gym", { p_slug: slug });
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

  project.provide("fixture", { run, gym: { id: gymId, slug, name: `Test Gym ${run}` }, planId: plan.id, users });

  return async () => {
    await removeGym(admin, gymId);
    for (const role of ROLES) await admin.auth.admin.deleteUser(users[role].id);
  };
}

async function removeGym(admin: ReturnType<typeof serviceClient>, gymId: string) {
  const { error } = await admin.from("gyms").delete().eq("id", gymId);
  if (error) console.warn(`Could not remove test gym ${gymId}: ${error.message}`);
}

// Gyms and accounts left by earlier runs that didn't finish (older than 2 h).
async function sweepLeftovers(admin: ReturnType<typeof serviceClient>) {
  const cutoff = new Date(Date.now() - STALE_MS).toISOString();
  const { data: gyms } = await admin.from("gyms").select("id").like("slug", "test-%").lt("created_at", cutoff);
  for (const g of gyms ?? []) await removeGym(admin, g.id);

  for (let page = 1; page < 20; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const users = data?.users ?? [];
    for (const u of users) {
      if (u.email && TEST_EMAIL.test(u.email) && u.created_at < cutoff) await admin.auth.admin.deleteUser(u.id);
    }
    if (users.length < 200) break;
  }
}
