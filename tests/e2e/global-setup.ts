import { mkdirSync, writeFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";
import { clientWithToken, PUBLISHABLE_KEY, serviceClient, SUPABASE_URL } from "../db/env";
import { HOURS_ALWAYS } from "../db/fixture-data";
import { createTestGym, ROLES, type TestGym, type TestRole } from "../support/test-gym";
import { AUTH_DIR, FIXTURE_FILE, authFile, type E2EFixture } from "./paths";

// Makes the throwaway gym, adds what the screens need (class, PT, workout
// plan, UPI, opening hours), and saves a signed-in browser state per role for
// the admin (cookies) and the member app (localStorage).
export default async function globalSetup() {
  mkdirSync(AUTH_DIR, { recursive: true });
  const t = await createTestGym();
  const extra = await seed(t);
  const fixture: E2EFixture = { ...t, ...extra };
  writeFileSync(FIXTURE_FILE, JSON.stringify(fixture, null, 2));

  for (const role of ROLES) {
    writeFileSync(authFile("admin", role), JSON.stringify({ cookies: await adminCookies(t, role), origins: [] }));
    writeFileSync(authFile("app", role), JSON.stringify(appStorage(t, role)));
  }
}

async function seed(t: TestGym) {
  const admin = serviceClient();
  const as = (role: TestRole) => clientWithToken(t.users[role].session.access_token);
  const must = <T extends { error: { message: string } | null }>(res: T, what: string) => {
    if (res.error) throw new Error(`Seeding ${what}: ${res.error.message}`);
    return res;
  };

  must(await admin.from("gyms").update({
    opening_hours: HOURS_ALWAYS,
    checkin_enabled: true, checkin_self_allowed: true, checkin_only_when_open: true,
    classes_enabled: true, classes_require_membership: false,
    workouts_enabled: true, pt_enabled: true, pt_show_in_app: true,
    nutrition_enabled: true,
    upi_id: "testgym@okhdfcbank", upi_payee_name: "Test Gym",
  }).eq("id", t.gym.id), "gym settings");

  // A Yoga class tomorrow evening, taught by the trainer.
  const type = must(await as("staff").from("class_types").insert({ gym_id: t.gym.id, name: "Yoga", default_capacity: 10, default_duration_min: 60 }).select("id").single(), "class type");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const tomorrowDow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 1) % 7;
  must(await as("staff").rpc("create_class_series", {
    p_class_type_id: type.data!.id, p_weekdays: [tomorrowDow], p_local_time: "18:00", p_start_date: today, p_weeks: 1, p_trainer_member_id: t.users.trainer.memberId!,
  }), "class");

  // A PT package, sold to the member with the trainer.
  const pkg = must(await as("owner").from("pt_packages").insert({ gym_id: t.gym.id, name: "12 PT sessions", price_paise: 600000, sessions: 12, validity_days: 60 }).select("id").single(), "PT package");
  must(await as("staff").rpc("sell_pt_package", { p_member_id: t.users.member.memberId!, p_package_id: pkg.data!.id, p_trainer_member_id: t.users.trainer.memberId!, p_method: "cash" }), "PT sale");

  // A one-day workout plan assigned to the member.
  const { data: exercises } = await admin.from("exercises").select("id, name").is("gym_id", null).in("name", ["Bench Press", "Lat Pulldown"]);
  const plan = must(await as("trainer").from("workout_plans").insert({ gym_id: t.gym.id, name: "Starter plan", created_by: t.users.trainer.memberId }).select("id").single(), "workout plan");
  must(await as("trainer").from("workout_plan_items").insert(exercises!.map((e, i) => ({ plan_id: plan.data!.id, day_label: "Day 1 · Upper", exercise_id: e.id, sets: 2, reps: "10", rest_sec: 60, position: i }))), "plan items");
  must(await as("trainer").from("plan_assignments").insert({ gym_id: t.gym.id, member_id: t.users.member.memberId!, plan_id: plan.data!.id, assigned_by: t.users.trainer.memberId }), "plan assignment");

  return { ptPackageId: pkg.data!.id, workoutPlanId: plan.data!.id };
}

// Cookies the admin's Supabase SSR client would set after signing in.
async function adminCookies(t: TestGym, role: TestRole) {
  const jar = new Map<string, string>();
  const sb = createServerClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (c) => c.forEach(({ name, value }) => jar.set(name, value)) },
  });
  const { session } = t.users[role];
  const { error } = await sb.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
  if (error) throw error;
  return [...jar].map(([name, value]) => ({ name, value, domain: "localhost", path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" as const }));
}

// What the member app keeps in localStorage on the web: the intro already
// seen, the Supabase session, and the chosen gym.
function appStorage(t: TestGym, role: TestRole) {
  const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
  return {
    cookies: [],
    origins: [{
      origin: "http://localhost:8081",
      localStorage: [
        { name: "gymos.welcomed", value: "1" },
        { name: `sb-${ref}-auth-token`, value: JSON.stringify(t.users[role].session) },
        ...(role === "outsider" ? [] : [{ name: "gymos.activeGym", value: t.gym.slug }]),
      ],
    }],
  };
}
