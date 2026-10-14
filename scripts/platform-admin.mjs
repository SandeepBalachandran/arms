// Makes an account a platform admin (the developers' view at /platform), or
// takes it away. The flag can't be set from the app, only with the service key.
//   npm run platform-admin -- you@example.com
//   npm run platform-admin -- you@example.com --off
//   npm run platform-admin -- dev@gymos.test --create dev12345   (new test account)
// Uses apps/web/.env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY).
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile("apps/web/.env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in apps/web/.env.local");
  process.exit(1);
}

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith("--") && a !== args[args.indexOf("--create") + 1])?.toLowerCase();
const off = args.includes("--off");
const createPassword = args.includes("--create") ? args[args.indexOf("--create") + 1] : null;
if (!email || (args.includes("--create") && !createPassword)) {
  console.error("Usage: npm run platform-admin -- <email> [--off] [--create <password>]");
  process.exit(1);
}

const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

async function findUser() {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === email);
    if (user || data.users.length < 1000) return user ?? null;
  }
}

let user = await findUser();
if (!user && createPassword) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: createPassword,
    email_confirm: true,
    user_metadata: { full_name: "Platform admin" },
  });
  if (error) throw error;
  user = data.user;
  console.log(`Created ${email}`);
}
if (!user) {
  console.error(`No account for ${email}. Sign up first, or pass --create <password>.`);
  process.exit(1);
}

const { error } = await admin.from("profiles").update({ is_platform_admin: !off }).eq("id", user.id);
if (error) throw error;
console.log(off ? `${email} is no longer a platform admin.` : `${email} is a platform admin. Sign in and open /platform.`);
