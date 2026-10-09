// Runs a command with variables from .env / .env.local loaded (values are never printed).
// Usage: node scripts/with-env.mjs <command> [args...]
import { config } from "dotenv";
import { spawnSync } from "node:child_process";

config({ path: [".env.local", ".env"], quiet: true });
const [cmd, ...args] = process.argv.slice(2);
const result = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
process.exit(result.status ?? 1);
