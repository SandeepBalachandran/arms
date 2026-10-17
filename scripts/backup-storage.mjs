// Downloads every file in the hosted project's storage (gym logos, profile
// photos, exercise photos) into a folder, keeping bucket/path. Part of the
// nightly backup (.github/workflows/db-backup.yml); the database itself is
// dumped by the Supabase CLI there. Plain fetch, so CI needn't install packages.
//   node scripts/backup-storage.mjs <out-dir>
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY from the environment
// (or apps/web/.env.local when run locally).
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

if (!process.env.SUPABASE_SECRET_KEY && existsSync("apps/web/.env.local")) process.loadEnvFile("apps/web/.env.local");
const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SECRET_KEY: key } = process.env;
const out = process.argv[2];
if (!url || !key || !out) {
  console.error("Usage: node scripts/backup-storage.mjs <out-dir> (needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY)");
  process.exit(1);
}
const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function api(path, init) {
  const res = await fetch(`${url}/storage/v1/${path}`, { ...init, headers: { ...headers, ...init?.headers } });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res;
}

// Folders come back as entries without an id; walk into them.
async function listAll(bucket, prefix = "") {
  const files = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await (
      await api(`object/list/${bucket}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: "name", order: "asc" } }),
      })
    ).json();
    for (const item of page) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) files.push(path);
      else files.push(...(await listAll(bucket, path)));
    }
    if (page.length < 1000) return files;
  }
}

const buckets = await (await api("bucket")).json();
let count = 0;
let bytes = 0;
for (const { id: bucket } of buckets) {
  for (const path of await listAll(bucket)) {
    const body = Buffer.from(await (await api(`object/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`)).arrayBuffer());
    const file = join(out, bucket, ...path.split("/"));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, body);
    count++;
    bytes += body.length;
  }
}
console.log(`Storage: ${count} files from ${buckets.length} buckets (${(bytes / 1e6).toFixed(1)} MB)`);
