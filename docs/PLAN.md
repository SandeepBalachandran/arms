# Gym SaaS — Flutter Member App + Next.js Admin

## Context
This is a multi-tenant gym SaaS. Phase 1 of the web app is already built in `c:\My Files\Tutorials\gymapp`: Next.js 16 with Supabase, covering auth, gym registration, roles, the admin shell, and a member PWA shell.

The user now wants real **Android/iOS apps built with Flutter** in place of the PWA. Gym owners can share the app in WhatsApp groups, and it can be found in the stores.

Decisions made with the user:
- **One shared app** ("GymOS") for all gyms, joined through a shared link.
- **The admin stays in Next.js**, in the browser.
- **Android first**, with iOS following.

Tooling status: Flutter, the Android SDK and a JDK are **not installed**. Docker can't run because WSL is missing, so a Supabase backend choice is still pending (local through WSL, or hosted).

## Architecture
```
Flutter app (members + staff scan mode) ─┐
                                         ├─► Supabase: Postgres + RLS, Auth, Storage, Realtime,
Next.js web (marketing, /join, admin,    │             Edge Functions (Razorpay), pg_cron
             platform console)          ─┘
```
- **Supabase is the single backend.** Both clients use the same RLS policies and RPCs, so the existing foundation migration is reused unchanged.
- **Logic that needs secrets lives in the backend, never in a client.**
  - **Postgres RPCs** (callable from both clients): `book_class()`, `cancel_booking()`, `issue_checkin_token()`, `check_in(token)`. Check-in tokens are signed with an HMAC whose key is stored in Supabase Vault.
  - **Supabase Edge Functions** (Deno): `razorpay-create-order` and `razorpay-webhook`. Each one reads the gym's Razorpay keys from `gym_secrets`. Using Edge Functions means Flutter doesn't depend on the Next.js server.
- **The Next.js app keeps:** the marketing page, `/register-gym`, the `/join/[slug]` landing page, `/admin/*`, `/platform/*`, and `/.well-known/assetlinks.json`, which Android App Links need.
- **The PWA is removed** from Next.js: delete `src/app/app/*`, and point `manifest.ts` at the admin or drop it.

## WhatsApp sharing and onboarding flow
1. The owner copies `https://<domain>/join/ironfit` from the admin dashboard; `CopyJoinLink` already exists. The page renders an Open Graph card so the link looks good in WhatsApp.
2. **If the app is installed (Android):** App Links open the app straight on its Join screen.
3. **If it isn't installed:** `/join/ironfit` shows the gym name and a "Get the app" button. The button goes to the Play Store URL with `&referrer=gym%3Dironfit`. On first launch, the app reads the **Play Install Referrer**, remembers the gym, and joins it after sign-in.
4. **iOS (later):** Universal Links handle the installed case, and the fallback is a "Paste link / enter gym code" field on the welcome screen. There is no reliable deferred deep link on iOS without a third-party service.
5. **Always available:** manual entry of a "Gym code" (the slug), plus a QR code at the gym's front desk that encodes the join link.

## Flutter app (`gymapp/mobile/`)
**Packages:**
- `supabase_flutter`: auth and data
- `flutter_riverpod`: state
- `go_router`: routing and deep links
- `app_links`: incoming links
- `play_install_referrer`: deferred joins
- `razorpay_flutter`: payments
- `qr_flutter`: showing the member QR
- `mobile_scanner`: QR scanning in staff mode
- `fl_chart`: charts
- `firebase_messaging`: push notifications
- `shared_preferences`: the pending gym slug

**Structure:** `lib/` is organised by feature, and each feature folder has `data/` (repositories over Supabase), `providers/` and `ui/` screens.
- `lib/core/`: the Supabase client, router, theme (lime-on-dark brand, matching the web), and error handling
- `lib/features/`: `auth`, `gyms` (join, switcher), `home`, `membership`, `checkin`, `classes`, `workouts`, `progress`, `profile`, `staff_scan`

**Screens:**
- **Welcome / auth:** email OTP code and Google sign-in. Phone OTP comes later because it needs an SMS provider such as MSG91 or Twilio.
- **Join gym:** opened by a link, the install referrer, or a typed code. It calls `join_gym`.
- **Home:** membership status and days left, the "My QR" card, the next class, and the streak.
- **Membership:** plans and Razorpay checkout, plus invoices.
- **Classes:** schedule, book or cancel, waitlist, and my bookings.
- **Workouts:** assigned plans, the logger (sets, reps, weight, rest timer), and history.
- **Progress:** body metrics, charts, and PRs.
- **Profile:** profile details, gym switcher, notification settings, and sign out.
- **Staff mode** (shown only for the owner, admin and staff roles): a full-screen QR scanner that calls `check_in(token)` and shows a green or red result.

**Payments:** the app calls `razorpay-create-order` and opens the Razorpay checkout. The **webhook is the source of truth** that activates the subscription; the app then refreshes its data.

**App Store note:** gym memberships are physical services, so taking payment through Razorpay outside Apple's in-app purchase is allowed.

## Data model
The model is unchanged from the original plan. The foundation is already in `supabase/migrations/20261009000000_foundation.sql`. Still to add:
- **Phase 2:** `plans`, `subscriptions`, `payments`, `invoices`
- **Phase 4:** `checkins`
- **Phase 5:** `class_types`, `class_sessions`, `bookings`
- **Phase 6:** `exercises`, `workout_plans`, `workout_plan_items`, `plan_assignments`, `workout_logs`, `workout_log_sets`, `body_metrics`
- **Phase 7:** `device_tokens` (user and FCM token, for push)

## Admin panel (Next.js, already scaffolded)
The admin panel is the same as in the previous plan: dashboard, members, plans & billing, front-desk check-in (webcam scanner and manual search), classes, trainers/staff, workouts, reports, and settings. The settings page adds the Razorpay keys, which an Edge Function writes encrypted into `gym_secrets`.

## Build phases
0. **Setup:**
   - Install the Flutter SDK, Android Studio (SDK and emulator) and JDK 17.
   - Choose the backend: hosted Supabase, or WSL plus Docker for a local stack.
   - Remove the PWA routes and add `assetlinks.json`, plus the Play Store button on `/join/[slug]`.
   - `flutter create mobile --org com.gymos --platforms android,ios`
1. **Flutter foundation:**
   - Supabase init, auth (email OTP and Google), router, theme
   - The join flow from a link, the referrer, or a code
   - Gym switcher and profile
   - Test on the emulator against the existing schema.
2. **Memberships:** plans and subscriptions tables, admin CRUD with manual payments, the membership screen in the app, and the expiry cron job.
3. **Payments:** the Edge Functions (create order, webhook with signature check, idempotent), Razorpay keys set up in admin, and checkout in the app.
4. **Check-in:** the token RPCs, the rotating QR in the app, the staff scan mode, the admin webcam scanner, and a live counter.
5. **Classes:** the booking RPCs with the waitlist, the admin calendar, and the app's schedule and bookings.
6. **Workouts & progress:** exercise seed, the admin plan builder, and the app's logger and metrics charts.
7. **Launch:**
   - FCM push for expiry and class reminders
   - Reports in the admin panel
   - Play Store internal testing, then production (signing key, privacy policy, data safety form)
   - iOS through a Codemagic cloud build or a Mac, plus TestFlight

## Verification
- **Backend:** `supabase db reset` loads the seed: 2 gyms, each with an owner, staff, a trainer and members. RLS tests confirm that gym A's rows are invisible to gym B. A concurrency test confirms `book_class()` never exceeds capacity.
- **Deep links:** `adb shell am start -a android.intent.action.VIEW -d "https://<domain>/join/ironfit"` opens the Join screen. A Play Store referrer test is done through internal testing. `assetlinks.json` is validated with Google's Digital Asset Links tester.
- **Payments:** in Razorpay test mode, checkout leads to the webhook, the subscription turns active, and the app shows it. Replaying the webhook is a no-op.
- **Check-in:** the member QR is scanned by staff mode on a second device or emulator and the check-in is recorded. A token older than 60 seconds is rejected.
- **Checks:** `flutter analyze` and `flutter test` (repository and provider unit tests, widget tests for the join and check-in screens), plus web typecheck, lint and build.
