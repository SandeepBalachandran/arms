import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../packages/shared/src/database.types";

process.loadEnvFile("apps/web/.env.local");

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

if (!SUPABASE_URL || !PUBLISHABLE_KEY || !SECRET_KEY) {
  throw new Error("DB tests need NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY in apps/web/.env.local");
}

const noSession = { persistSession: false, autoRefreshToken: false };

export type Db = ReturnType<typeof createClient<Database>>;

// Bypasses RLS. Only for creating and removing test fixtures, never for the
// thing under test.
export function serviceClient(): Db {
  return createClient<Database>(SUPABASE_URL, SECRET_KEY, { auth: noSession });
}

export function anonClient(): Db {
  return createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, { auth: noSession });
}

// A client acting as a signed-in user (their access token), like the apps.
export function clientWithToken(token: string): Db {
  return createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: noSession,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}
