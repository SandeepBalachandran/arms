// Creates a demo gym with an owner (admin) and one member, plus two plans.
// Safe to re-run: existing users/gym are reused. Uses apps/web/.env.local
// (SUPABASE_SECRET_KEY to create confirmed users without email).
//   node scripts/seed-demo.mjs
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile("apps/web/.env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !publishable || !secret) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY");
  process.exit(1);
}

const GYM = { name: "Demo Fitness", slug: "demo-fitness" };
const USERS = {
  admin: { email: "admin@gymos.test", password: "GymOS-admin-2026", full_name: "Asha Owner" },
  member: { email: "member@gymos.test", password: "GymOS-member-2026", full_name: "Ravi Member" },
};

const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

async function ensureUser({ email, password, full_name }) {
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });
  if (error && !/already/i.test(error.message)) throw error;
  // Sign in as the user so RPCs run with their identity (auth.uid()).
  const client = createClient(url, publishable, { auth: { persistSession: false } });
  const { data, error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  await client.from("profiles").update({ full_name }).eq("id", data.user.id);
  return { client, id: data.user.id };
}

const owner = await ensureUser(USERS.admin);
const member = await ensureUser(USERS.member);

let { data: gym } = await admin.from("gyms").select("id").eq("slug", GYM.slug).maybeSingle();
if (!gym) {
  const { data: id, error } = await owner.client.rpc("register_gym", { p_name: GYM.name, p_slug: GYM.slug });
  if (error) throw error;
  gym = { id };
}

const { error: joinError } = await member.client.rpc("join_gym", { p_slug: GYM.slug });
if (joinError) throw joinError;

const { count } = await admin.from("plans").select("id", { count: "exact", head: true }).eq("gym_id", gym.id);
if (!count) {
  const { error } = await owner.client.from("plans").insert([
    { gym_id: gym.id, name: "Monthly", price_paise: 149900, duration_days: 30, description: "Gym floor access", sort_order: 1 },
    { gym_id: gym.id, name: "Quarterly", price_paise: 399900, duration_days: 90, description: "Save ₹500", sort_order: 2 },
  ]);
  if (error) throw error;
}

console.log(`Gym: ${GYM.name} (code: ${GYM.slug})`);
for (const [role, u] of Object.entries(USERS)) console.log(`${role.padEnd(6)} ${u.email}  /  ${u.password}`);
