// Runs Supabase CLI database commands against the hosted project, using
// apps/web/.env.local (the password is never printed). The direct connection is
// IPv6-only; on IPv4-only networks set SUPABASE_DB_URL to the session pooler
// string (Dashboard → Connect → Session pooler) with the password filled in.
//   node scripts/db.mjs push       apply new migrations (asks to confirm)
//   node scripts/db.mjs push --dry-run
//   node scripts/db.mjs types      regenerate packages/shared/src/database.types.ts
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

process.loadEnvFile("apps/web/.env.local");
const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_DB_PASSWORD: password = "", SUPABASE_DB_URL: poolerUrl } = process.env;
if (!url || (!password && !poolerUrl)) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_DB_PASSWORD (or SUPABASE_DB_URL) in apps/web/.env.local");
  process.exit(1);
}
const ref = new URL(url).hostname.split(".")[0];
const dbUrl = poolerUrl || `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`;
const secrets = [password, encodeURIComponent(password), poolerUrl && new URL(poolerUrl).password].filter(Boolean);
const hide = (text) => secrets.reduce((t, s) => t.split(s).join("***"), text);

const [command, ...rest] = process.argv.slice(2);
const args = {
  push: ["db", "push", "--db-url", dbUrl, ...rest],
  types: ["gen", "types", "typescript", "--db-url", dbUrl, "--schema", "public"],
}[command];
if (!args) {
  console.error("Usage: node scripts/db.mjs <push|types> [--dry-run]");
  process.exit(1);
}

const result = spawnSync("npx", ["supabase", ...args.map((a) => JSON.stringify(a))], {
  shell: true,
  encoding: "utf8",
  maxBuffer: 1e8,
  stdio: command === "push" ? ["inherit", "pipe", "pipe"] : "pipe",
});
if (command === "types" && result.status === 0) {
  writeFileSync("packages/shared/src/database.types.ts", result.stdout);
  console.log("Wrote packages/shared/src/database.types.ts");
} else {
  process.stdout.write(hide(result.stdout ?? ""));
}
process.stderr.write(hide(result.stderr ?? ""));
process.exit(result.status ?? 1);
