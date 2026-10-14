// Builds the one site: the member app's web build (Expo) goes into the Next.js
// public/app folder, then Next.js builds around it. Used by Vercel
// (`npm run build:site`). Needs the NEXT_PUBLIC_SUPABASE_* variables.
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

// Locally the settings live in apps/web/.env.local; on Vercel they're environment variables.
if (existsSync("apps/web/.env.local")) process.loadEnvFile("apps/web/.env.local");

const env = {
  ...process.env,
  EXPO_PUBLIC_WEB_BASE: "/app",
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
};
if (!env.EXPO_PUBLIC_SUPABASE_URL || !env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY first.");
  process.exit(1);
}
const run = (cmd) => execSync(cmd, { stdio: "inherit", env });

run("npm run export:web -w @gymos/mobile -- --output-dir ../web/public/app");
run("npm run build -w @gymos/web");
