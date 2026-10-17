import { GYM_DEFAULTS, internationalPhone, isPin } from "@gymos/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Phone number + PIN sign-in (packages/shared/src/sign-in.ts). Supabase signs
// in by email + password only, so this finds the account by phone and signs
// in with its email (often a placeholder) and the PIN. On the web the session
// cookies are set here; the member app (native or /app) gets the tokens back
// and calls supabase.auth.setSession. Five wrong PINs lock the number for 15
// minutes. Every failure gives the same answer, so nobody learns which
// numbers have accounts.

const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;
const WRONG = "Wrong phone number or PIN.";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { phone?: unknown; pin?: unknown } | null;
  const phone = typeof body?.phone === "string" ? internationalPhone(body.phone, GYM_DEFAULTS.phone_country_code) : null;
  const pin = typeof body?.pin === "string" ? body.pin.trim() : "";
  if (!phone || !isPin(pin)) return Response.json({ error: "Enter your phone number and 6-digit PIN." }, { status: 400 });

  const admin = createAdminClient();
  const { data: attempt } = await admin.from("pin_attempts").select("failures, locked_until").eq("phone", phone).maybeSingle();
  if (attempt?.locked_until && new Date(attempt.locked_until) > new Date()) {
    const minutes = Math.ceil((new Date(attempt.locked_until).getTime() - Date.now()) / 60_000);
    return Response.json({ error: `Too many wrong tries. Try again in ${minutes} min, or ask the gym for a new PIN.` }, { status: 429 });
  }

  const fail = async () => {
    const failures = (attempt?.locked_until ? 0 : attempt?.failures ?? 0) + 1;
    const locked = failures >= MAX_FAILURES;
    await admin.from("pin_attempts").upsert({
      phone,
      failures: locked ? 0 : failures,
      locked_until: locked ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null,
      updated_at: new Date().toISOString(),
    });
    return Response.json(
      { error: locked ? `Too many wrong tries. Try again in ${LOCK_MINUTES} min, or ask the gym for a new PIN.` : WRONG },
      { status: locked ? 429 : 401 },
    );
  };

  const { data: userId } = await admin.rpc("find_user_id", { p_phone: phone });
  if (!userId) return fail();
  const { data: found } = await admin.auth.admin.getUserById(userId);
  const email = found.user?.email;
  if (!email) return fail();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pin });
  if (error || !data.session) return fail();

  if (attempt) await admin.from("pin_attempts").delete().eq("phone", phone);
  return Response.json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
}
