import { createServerClient } from "@supabase/ssr";
import type { Session } from "@supabase/supabase-js";
import { PUBLISHABLE_KEY, SUPABASE_URL } from "../db/env";

// The cookies the Supabase SSR client sets after signing in. On the web both
// the admin and the member app keep the session in them (one site, one
// sign-in); cookies ignore the port, so "localhost" covers both dev servers.
export async function sessionCookies(session: Pick<Session, "access_token" | "refresh_token">) {
  const jar = new Map<string, string>();
  const sb = createServerClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (c) => c.forEach(({ name, value }) => jar.set(name, value)) },
  });
  const { error } = await sb.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
  if (error) throw error;
  return [...jar].map(([name, value]) => ({ name, value, domain: "localhost", path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" as const }));
}
