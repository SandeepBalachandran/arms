# How GOS Works

This document explains GOS end to end. Part 1 describes the product: who uses it and what happens in each flow. Part 2 describes the system: architecture, data, security, and how to run, change and ship it.

For what has been built so far and what comes next, see [PLAN.md](PLAN.md).

---

# Part 1 — The product

## What GOS is

GOS is software for running a gym, offered to many gyms at once (multi-tenant).

- **Gym owners and staff** use the **web admin** in a browser, on a laptop or a phone.
- **Members** use the **GOS app** on Android (iOS later). There is one shared app for every gym; a member joins *their* gym inside it.
- A gym only sees its own members, payments and data.

Optional features (check-in, classes, workouts, personal training) are switched on per gym. A small gym where people just pay and train can turn them all off and use only memberships and payments.

## Who does what (roles)

Each person has a role **per gym**. The same person can be a member at one gym and staff at another.

| Role | Web admin | What they can do |
|---|---|---|
| **Owner** | Yes | Everything, including Settings, making admins, and editing plans and PT packages |
| **Admin** | Yes | Same as owner, except they can't make other admins |
| **Staff** | Yes | Front desk: add and approve members, record payments, confirm UPI, check people in, sell PT, schedule classes |
| **Trainer** | Yes (limited) | See members, mark class attendance, build workout plans, log PT sessions for their own clients |
| **Member** | No | Use the app: membership, payments, check-in QR, classes, workouts, PT progress |

The database enforces these rules, not just the screens (see [Security](#security)).

## The life of a gym

### 1. A gym signs up
1. The owner creates an account on the website and fills in **Register your gym** (name, gym code, timezone).
2. The gym code (for example `demo-fitness`) becomes the gym's address: `/admin/demo-fitness` for the admin, and `/join/demo-fitness` for members.
3. The owner checks **Settings**. Everything has Indian defaults (+91, ₹ INR, Asia/Kolkata, a renewal message), so most gyms only add their UPI ID and opening hours.
4. The owner creates **Plans**, for example Monthly ₹1,499 and Quarterly ₹3,999.

### 2. Members join
There are three ways in. All of them end with the member joined to the gym in the app.

| Way | How it works |
|---|---|
| **WhatsApp link** | The admin shares `https://<site>/join/<gym-code>`. With the app installed, the link opens it straight to "Join". Without it, the page sends them to the Play Store, and the app remembers the gym after install (Play install referrer). |
| **Gym code** | In the app: *Join a gym* → type the code. |
| **Added by staff** | On **Members → Add member**, staff enter a name with an email and/or phone. GOS creates the account; the member signs in later with that email or phone. |

If **Approve new members** is on (Settings), people who join themselves wait as *pending* until staff approve them on the Members page.

Members sign in with a 6-digit code sent to their email, or with a password.

### 3. Memberships and payments
A **plan** has a price and a duration. Buying one creates a **subscription** (start and end date). Money is recorded as a **payment** with a receipt number (with an optional prefix, e.g. `DF-12`).

**Paying at the front desk:** staff open the member → **Record payment** → choose plan, method (cash, UPI, card, bank transfer — whichever the gym allows) and amount (lower it for a discount). The membership starts at once, or right after the current one ends if they renew early.

**Paying by UPI in the app (no payment gateway, no fees):**
1. The member picks a plan and taps **Pay with UPI**. Their UPI app (GPay, PhonePe…) opens with the gym's UPI ID and the amount filled in.
2. After paying, they enter the UPI reference number and tap **I've paid**.
3. Staff see it under **Payments → Waiting for confirmation** (and in the bell menu). They check their UPI app, then **Confirm** (the membership starts) or **Reject** with a reason (the member sees it).
4. A member can only have one payment waiting at a time, and can withdraw it if the payment didn't go through.

**Expiry:** every hour, a database job marks ended subscriptions as expired. Members whose plan ends within the *expiry warning* (default 7 days) show as **Expiring soon**. A **Send reminder** button opens WhatsApp with the gym's renewal message filled in. Placeholders `{name}`, `{gym}`, `{date}` and `{plan}` are replaced with real values.

Nobody is blocked by software for an expired plan; staff decide. The admin only flags it.

### 4. Check-in (optional)
For gyms that want attendance:

- **Member QR:** the app shows a QR code that changes every 50 seconds and is only valid for 2 minutes, so a screenshot can't be reused. Staff scan it with **Front desk scan** in the app or the webcam on the admin **Check-in** page.
- **Self check-in:** if allowed, members tap **Check in** in the app when they arrive.
- **At the desk:** staff search a name and tap **Check in**.

Check-ins within a set time of each other count as one visit (default 3 hours). The Check-in page updates live as people arrive. A member without an active plan is still checked in, just flagged.

### 5. Group classes (optional)
1. Create **class types** (e.g. Zumba: 20 spots, 45 minutes).
2. **Schedule classes:** pick the days, time, start date and number of weeks. GOS creates every session (e.g. "Adds 12 classes").
3. Members **book** in the app. When a class is full they join the **waitlist**; if someone cancels, the first person waiting moves up automatically.
4. Rules come from Settings: how many days ahead booking opens, how late members can cancel, and whether an active membership is required.
5. After the class, the trainer marks **Came / No-show**. Staff can cancel a session with a reason; members see it as cancelled.

### 6. Workouts and progress (optional)
- Trainers build **workout plans** (days → exercises with sets, reps and rest) from a built-in library of 41 exercises plus the gym's own, and **assign** them to members.
- Members open a plan day, **log** the sets they did (the app shows last time's numbers), and track **body weight and measurements**.
- **Progress** shows charts and personal records.

### 7. Personal training (optional)
- **Packages** are priced either as a *pack of sessions* (12 sessions to use within 2 months for ₹6,000) or *unlimited for a period* (Monthly PT).
- Staff **sell** a package to a member: choose the trainer, payment method and amount. It gets a receipt like any payment.
- The trainer (or staff) **logs each session**, with a date and an optional note. A pack can't go below zero, and nothing can be logged outside its dates or after it's cancelled. Mistakes can be undone.
- The **Personal training** page lists clients with sessions left, last session and expiry, flags those **running low**, and lists clients whose package ended in the last 30 days (people to offer a renewal). Trainers see their own clients first.
- Members see their package, trainer, sessions left and recent sessions in the app. If the gym allows it, they also see packages and prices.

### 8. Opening hours
Each weekday has an optional **morning** and **evening** session (default Mon–Sat 5–10 am and 4–9 pm, Sunday 6–10 am), plus a note such as "Closed on national holidays". The app shows **Open now · until 9:00 pm** or **Closed · opens 4:00 pm**, a timeline of today, and the full week. Hours are information only; they never block check-in.

## The member app at a glance

| Screen | What's on it |
|---|---|
| **Welcome** (first launch) | Three intro slides, then sign-in |
| **Home** | Greeting and a bell (lit when the membership needs attention); membership days-left ring; check-in; *This week* activity chart with streak; *Today* card (next class, else workout plan, else today's hours); Explore tiles; gym hours |
| **Classes** | Upcoming classes with spots left; book, cancel, join the waitlist |
| **Workouts** | Assigned plans, start a workout, progress |
| **Membership** | Current plan with a timeline, plans and prices, UPI payment status, personal training, receipts |
| **Profile** | Name and phone, light/dark theme, switch or join another gym, sign out |
| **Staff scan** | Camera QR scanner (staff roles only) |

Tabs for features a gym hasn't turned on are hidden.

## The web admin at a glance

| Page | Purpose |
|---|---|
| **Dashboard** | Today's numbers, expiring members, things waiting for action |
| **Members** | Search, filter by status, add, approve, edit; each member has a full page (stats, history, notes, payments, PT) |
| **Check-in** | Webcam scanner, desk check-in, live list (optional) |
| **Classes** | Week calendar, scheduling, class types, attendance (optional) |
| **Workouts** | Exercise library, plan builder, assignments (optional) |
| **Personal training** | Clients, packages, sales and sessions (optional) |
| **Plans** | Membership plans: create, edit, hide, delete (only if never sold) |
| **Payments** | UPI payments waiting for confirmation, payment history |
| **Settings** | Gym profile, opening hours, memberships, UPI, check-in, classes, workouts, PT |
| **Profile** | Your own name, password, sign out everywhere |

The admin works on phones too, with a bottom navigation bar.

---

# Part 2 — The system

## Architecture

```
 ┌───────────────────────┐        ┌───────────────────────┐
 │  Web admin (Next.js)  │        │  Member app (Expo)    │
 │  apps/web             │        │  apps/mobile          │
 │  server components +  │        │  react-query +        │
 │  server actions       │        │  supabase-js          │
 └──────────┬────────────┘        └──────────┬────────────┘
            │      both use the same          │
            │      tables, RLS and RPCs       │
            ▼                                 ▼
 ┌─────────────────────────────────────────────────────────┐
 │                 Supabase (hosted)                        │
 │  Auth · Postgres + Row Level Security · RPC functions    │
 │  pg_cron (hourly expiry) · Realtime (check-ins)          │
 └─────────────────────────────────────────────────────────┘
            ▲
            │  shared types, validation and rules
 ┌──────────┴──────────────┐
 │  packages/shared        │
 │  (@gymos/shared)        │
 └─────────────────────────┘
```

**Key idea:** there is no separate API server. Both apps talk to Supabase directly as the signed-in user. Postgres **Row Level Security** decides what each user can read or write, and anything with several steps or rules runs inside **database functions (RPCs)**. A rule therefore holds no matter which app (or which hand-made request) calls it.

## Repository layout

```
apps/web/                 Next.js 16 (App Router)
  src/app/                pages; admin lives under admin/[slug]/
  src/app/admin/[slug]/*/actions.ts   server actions (form handlers)
  src/components/         UI kit, modal, dropdown, toasts, tooltips
  src/lib/                auth helpers, Supabase clients, theme
  src/proxy.ts            protects /admin, /account, /platform, /register-gym
apps/mobile/              Expo SDK 57
  src/app/                screens (expo-router: file = route)
  src/components/         cards, charts, motion kit, UI kit
  src/lib/                data hooks per feature (memberships, classes, pt…)
  src/constants/theme.ts  colours for light and dark
packages/shared/src/      code used by both apps
  database.types.ts       generated from the live database
  memberships.ts, upi.ts, checkins.ts, classes.ts, workouts.ts,
  pt.ts, hours.ts, settings.ts, collections.ts
supabase/migrations/      the database, as ordered SQL files
supabase/templates/       sign-in email templates (6-digit code)
scripts/                  db.mjs (push / types), seed-demo.mjs
docs/                     PLAN.md, HOW-IT-WORKS.md
```

## Tech stack

| Part | Choices |
|---|---|
| Web | Next.js 16 (App Router, server actions, React Compiler), Tailwind CSS v4, react-hot-toast, Radix Tooltip, lucide icons |
| Mobile | Expo SDK 57, React Native 0.86, expo-router, @tanstack/react-query, Reanimated 4, react-native-svg, lucide-react-native, expo-camera, react-native-qrcode-svg |
| Backend | Supabase: Postgres, Auth, RLS, SQL/PLpgSQL functions, pg_cron, Realtime |
| Shared | TypeScript, zod |
| Builds | EAS Build (`apps/mobile/eas.json`) |

## Data model

All gym data carries a `gym_id`. Tables by area:

| Area | Tables | Notes |
|---|---|---|
| People and gyms | `profiles`, `gyms`, `gym_members`, `gym_secrets` | `profiles` is created automatically for each new auth user. `gym_members` links a person to a gym with a role and status (`active`, `pending`, `inactive`). All gym **settings are columns on `gyms`**. |
| Memberships | `plans`, `subscriptions`, `payments` | A subscription copies the plan name and price at sale time. Payments get a per-gym receipt number from a trigger. Statuses: `created` (UPI waiting), `paid`, `failed`. |
| Check-in | `checkins`, `app_secrets` | `app_secrets` holds the key used to sign QR tokens. |
| Classes | `class_types`, `class_sessions`, `class_bookings` | Booking status: `booked`, `waitlisted`, `attended`, `no_show`, `cancelled`. |
| Workouts | `exercises`, `gym_hidden_exercises`, `workout_plans`, `workout_plan_items`, `plan_assignments`, `workout_logs`, `workout_log_sets`, `body_metrics` | Exercises with no `gym_id` are the built-in library. |
| Personal training | `pt_packages`, `pt_subscriptions`, `pt_sessions` | A PT sale copies the package name and session count. Its payment points to it through `payments.pt_subscription_id`. |
| Team | `member_notes` | Staff-only notes on a member. |

**Conventions**
- **Money** is stored as integer **paise** (₹1,499 = `149900`) and formatted with the gym's currency.
- **Dates** that are "days" (start, end, session day) are `YYYY-MM-DD` in the **gym's timezone**; timestamps are UTC.
- **Opening hours** live in `gyms.opening_hours` as JSON: `{"mon": {"morning": ["05:00","10:00"], "evening": ["16:00","21:00"]}, …}`.

## Security

**Row Level Security on every table.** Policies use a few helper functions:

| Helper | True when the signed-in user… |
|---|---|
| `auth_role_in(gym)` | returns their role in that gym (null if none) |
| `is_gym_staff(gym)` | is owner, admin or staff there |
| `is_gym_team(gym)` | is staff or a trainer there |
| `is_my_membership(member)` | is that gym member |

Typical rules: members read only their own subscriptions, payments, check-ins and bookings; staff read everything in their gym; only owners and admins change plans, PT packages and settings.

**Database functions (RPCs)** do multi-step work in one transaction and check permissions themselves (`security definer`). The main ones:

| Area | Functions |
|---|---|
| Gyms | `register_gym`, `join_gym`, `review_join_request`, `find_user_id` (server only) |
| Memberships | `start_subscription`, `record_manual_payment`, `cancel_subscription`, `expire_subscriptions` (cron) |
| UPI | `claim_upi_payment`, `withdraw_upi_payment`, `confirm_upi_payment`, `reject_upi_payment` |
| Check-in | `issue_checkin_token`, `check_in_by_token`, `self_check_in`, `staff_check_in` |
| Classes | `class_schedule`, `create_class_series`, `book_class`, `cancel_booking`, `cancel_class_session`, `mark_attendance` |
| PT | `sell_pt_package`, `log_pt_session`, `delete_pt_session`, `my_pt_subscriptions` |

**Secrets**
- The mobile app and browser only ever have the Supabase **publishable** key.
- The **secret key** (used to create member accounts and look up emails) and the **database password** (used by the migration scripts) live only in `apps/web/.env.local` on the server. They must never be put in the mobile app or any `EXPO_PUBLIC_*` / `NEXT_PUBLIC_*` variable.
- QR tokens are signed in Postgres with a key the apps never see, so they can't be forged.

**Race conditions** are handled with row locks:
- **Last spot in a class:** two people can't both get it.
- **Last session on a PT pack:** it can't be used twice.
- **UPI claims:** a member can have at most one waiting at a time.

## Key flows, step by step

### UPI payment
```
Member app                          Database                         Admin
──────────                          ────────                         ─────
pick plan → upiPayLink() opens UPI app
pays in UPI app, enters reference
claim_upi_payment(plan, ref) ──────► payment: status 'created'
                                                                     sees "Waiting for confirmation"
                                    confirm_upi_payment(id) ◄─────── Confirm
                                    → start_subscription()
                                    → payment 'paid' + receipt no.
app refetches: membership active ◄──
```

### QR check-in
1. The app calls `issue_checkin_token`, which returns a token signed with the gym's key and stamped with the time. It refreshes every 50 seconds.
2. Staff scan it, and the scanner calls `check_in_by_token`.
3. The function checks the signature and that the token is under 2 minutes old.
4. It then records the visit, or returns the existing one if the member checked in within the repeat window.
5. The admin Check-in page listens with Supabase Realtime and refreshes live.

### Class booking
1. `book_class` locks the session row and checks the booking window and membership rule.
2. It then books the member, or adds them to the waitlist if the class is full.
3. `cancel_booking` enforces the cancel cutoff and promotes the first waitlisted member.

### Selling and using PT
1. `sell_pt_package` checks that PT is on, the payment method is allowed and the trainer belongs to the gym.
2. It creates the client's package (start to start + validity) and a paid payment with a receipt.
3. `log_pt_session` locks the package and checks that the caller is staff or the assigned trainer, the date is within validity and sessions remain.

## How the web admin is built

- **Pages are server components.** They load data with the user's Supabase session (`lib/supabase/server.ts`) and render on the server.
- **`requireGym(slug, roles)`** (`lib/auth.ts`) loads the signed-in user, finds their membership of that gym, and returns `{ user, gym, role, memberId }`. If they lack access, the page shows "not found". The full `gym` row, including settings, is available on every admin page.
- **Changes go through server actions** in each section's `actions.ts`. Each one validates input with zod, checks the role, calls Supabase (usually an RPC), then refreshes the affected pages with `revalidatePath`.
- **Forms:**
  - Forms with fields use `useActionState` plus `useSavedToast`, which shows a toast and closes the popup on success.
  - One-click buttons use `<ActionForm>`, which shows success and error toasts and can ask "Are you sure?" first.
  - Actions return `{ error }` instead of throwing, so the user sees the real reason.
- **Popups** are native `<dialog>` elements that close only with ✕ or Esc.
- **Theme:** stored in a cookie and applied on the server, so pages never flash the wrong theme.

## How the member app is built

- **Routing:** expo-router, where each file in `src/app` is a screen. `_layout.tsx` decides what the user can reach:
  - signed out → welcome (first launch only) and sign-in
  - signed in without a gym → join
  - otherwise → the gym tabs and other screens
- **Data:** one hook per feature in `src/lib` (e.g. `useMembership`, `useSchedule`, `useMyPt`), using react-query with Supabase. Pull to refresh re-fetches.
- **Active gym:** members can belong to several gyms; the chosen one is remembered on the device.
- **Session storage:** on the phone it's a SQLite-backed `localStorage`; in a browser it's the browser's own.
- **Look:**
  - Colours come from `constants/theme.ts` (light and dark).
  - Primitives (Button, Card, Text, IconButton…) come from `components/ui.tsx`.
  - Animations come from `components/motion.tsx` and turn off when the phone's *reduce motion* setting is on.
- **Feature switches:** screens and tabs check `gym.classes_enabled`, `gym.workouts_enabled`, `gym.pt_enabled`, etc., and hide themselves when a feature is off.

## Shared package (`@gymos/shared`)

Logic both apps need lives here so it behaves identically:
- **`membershipState()`:** active, upcoming, expired or none, with days left.
- **`openStatus()`:** open now, and until or from when.
- **`ptState()`:** sessions left, running low, expired.
- **Formatting:** `formatMoney`, `formatDate`, `formatTime`, `formatDuration`.
- **Links and templates:** `upiPayLink()`, `renderTemplate()` for WhatsApp messages, `whatsappNumber()`.
- **Settings:** validation schemas and `GYM_DEFAULTS`.
- **Database types:** generated from the live database, so a wrong column name fails the typecheck.

## Configuration reference (per gym, in Settings)

| Section | Settings (default) |
|---|---|
| Gym profile | name, address, phone, currency (INR), phone country code (91), timezone (Asia/Kolkata) |
| Opening hours | morning/evening per weekday (Mon–Sat 5–10 am & 4–9 pm, Sun 6–10 am), note |
| Memberships | expiry warning days (7), renewal message (with placeholders), receipt prefix (none), payment methods allowed at the desk, approve new members (off) |
| UPI | UPI ID and the account holder's name (empty = UPI off; INR only) |
| Check-in | on/off (off), members can self check-in, repeat window in hours (3) |
| Classes | on/off (off), booking opens days ahead (7), cancel cutoff in hours (0 = any time), require active membership |
| Workouts | on/off (off); hide built-in exercises on the Workouts page |
| Personal training | on/off (off), show packages in the app (on), "running low" at N sessions (2) |

## Running it locally

**Requirements:** Node.js 20.9 or newer (developed on 24), npm, and a Supabase project (hosted). Docker is only needed for a local Supabase.

1. `npm install` at the repo root.
2. **Web:** copy `apps/web/.env.example` to `apps/web/.env.local` and fill in:
   - **Required:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`.
   - **For adding members:** `SUPABASE_SECRET_KEY`.
   - **For migrations:** `SUPABASE_DB_PASSWORD`.
3. **Mobile:** copy `apps/mobile/.env.example` to `apps/mobile/.env.local` and fill in `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `EXPO_PUBLIC_APP_LINK_HOST`. Never put secrets here.
4. Run:

| Command | What it does |
|---|---|
| `npm run web` | Admin at http://localhost:3000 |
| `npm run mobile` | Expo dev server; open the shown `exp://…` address in **Expo Go** on a phone on the same Wi-Fi |
| `npm run mobile:web` | The member app in a browser at http://localhost:8081 |
| `npm run db:push` | Apply new migrations to the hosted database |
| `npm run db:types` | Regenerate `packages/shared/src/database.types.ts` from the database |
| `npm run db:seed-demo` | Create the demo gym and accounts (safe to run again) |
| `npm run typecheck` / `npm run lint` | Check both apps |

**Demo accounts:**
- Owner: `admin@gymos.test` / `GOS-admin-2026`
- Admin: `manager@gymos.test` / `GOS-manager-2026`
- Staff: `staff@gymos.test` / `GOS-staff-2026`
- Trainer: `trainer@gymos.test` / `GOS-trainer-2026`
- Member: `member@gymos.test` / `GOS-member-2026`
- Gym code: `demo-fitness`

## Changing the database

1. Add a new file `supabase/migrations/<timestamp>_<name>.sql`. Never edit one that has already been applied.
2. Enable RLS and write policies for any new table. Put multi-step or permission-sensitive logic in a `security definer` function that checks the caller's role.
3. `npm run db:push`, then `npm run db:types`.
4. Use the new types in both apps. Add new gym settings to `settings.ts` (schema plus default) and to the Settings page.

## Building and releasing the app

The app supports **Android 7.0+** and targets Android 16.

Builds run on Expo's EAS service (profiles in `apps/mobile/eas.json`):
1. `npx eas-cli login`, then `eas init` in `apps/mobile` (first time only).
2. Set `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `EXPO_PUBLIC_APP_LINK_HOST` as EAS environment variables (`eas env:create`). `.env.local` isn't uploaded.
3. Pick a build:
   - **Test APK** (installable, shareable): `eas build -p android --profile preview`
   - **Google Play** (.aab): `eas build -p android --profile production`, then `eas submit -p android`
4. For join links to open the app, deploy the web admin to `EXPO_PUBLIC_APP_LINK_HOST`. Then set `ANDROID_SHA256_CERT_FINGERPRINTS` (from EAS credentials) so `/.well-known/assetlinks.json` verifies the app.

## How changes are checked

Before each change is pushed:
1. Typecheck and lint both apps.
2. Click through the changed flows in a headless browser against the real database, with screenshots at desktop and phone sizes. The member app is tested through its browser build.
3. Test database rules live, e.g. a member calling a staff-only function must be refused.

## Known limits (today)

- No automatic messages yet. WhatsApp reminders open a ready-made message that staff send themselves; there is no SMS and no push notifications.
- UPI payments are confirmed by hand; there is no bank or gateway integration by design.
- PT is sold at the front desk only, not by UPI in the app.
- iOS builds and Play Store publishing haven't been done yet.
- Join links only open the app once the web admin is live on its real domain; until then, members join with the gym code.
