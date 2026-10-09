# Gym SaaS — Expo (React Native) Member App + Next.js Admin

## Context
This is a multi-tenant gym SaaS. Phase 1 of the web admin is built and pushed to github.com/SandeepBalachandran/arms: Next.js 16 with Supabase, covering auth, gym registration, roles, the admin shell, the `/join/[slug]` install page, and `assetlinks.json`.

Members get a native Android/iOS app that gym owners share through WhatsApp. **React Native with Expo** was chosen over Flutter for these reasons:
- It uses the same TypeScript and React the user already works in.
- Types and validation are shared with the web app.
- EAS builds iOS from Windows.
- EAS Update ships fixes without a store review.

Decisions made with the user:
- **One shared app** ("GymOS"), joined through a shared link.
- **The admin stays in Next.js**, in the browser.
- **Android first**, with iOS following.

## Repo layout (npm workspaces monorepo)
```
apps/web       Next.js admin + marketing + /join (moved from repo root)
apps/mobile    Expo app (expo-router, TypeScript)
packages/shared  @gymos/shared: database.types.ts, zod schemas, constants (roles, slug rules)
supabase/      migrations, seed, edge functions (shared backend, stays at root)
docs/PLAN.md
```

## Architecture
- **Supabase is the single backend** for both clients, through the same RLS policies and RPCs.
- **Logic that needs secrets lives in the backend, never in a client.**
  - **Postgres RPCs:** `book_class`, `cancel_booking`, `issue_checkin_token`, `check_in`. Check-in tokens are signed with an HMAC whose key is stored in Supabase Vault.
  - **Edge Functions:** `razorpay-create-order` and `razorpay-webhook`, using each gym's keys from `gym_secrets`.
- **Web:** the marketing page, `/register-gym`, `/join/[slug]` (Play Store link with `referrer=gym=<slug>`), `/admin/*`, `/platform/*`, and `/.well-known/assetlinks.json`.

## WhatsApp sharing and onboarding flow
1. The owner taps "Share on WhatsApp" in the admin panel, which shares `https://<domain>/join/<slug>`.
2. **If the app is installed:** Android App Links open the app's `join/[slug]` route. This is configured as `intentFilters` with `autoVerify` in `app.json`.
3. **If it isn't installed:** the Play Store listing opens with the referrer attached. On first launch, `react-native-play-install-referrer` reads it, the slug is saved, and the app joins that gym after sign-in.
4. **Always available:** typing the gym code (the slug) on the "Join a gym" screen. iOS uses Universal Links later, with code entry as its fallback.

## Mobile app (`apps/mobile`)
**Stack:**
- Expo SDK (latest) with `expo-router`
- `@supabase/supabase-js`, with the session stored in `expo-secure-store` (or `AsyncStorage` for large sessions)
- `@tanstack/react-query` for data fetching
- `expo-camera` for scanning the QR in staff mode
- `react-native-qrcode-svg` for showing the member QR
- `react-native-razorpay`, which needs a dev build
- `expo-notifications`
- `victory-native` or `react-native-gifted-charts` for charts

**Routes:**
- `(auth)/sign-in`: email OTP with a 6-digit code (`signInWithOtp` + `verifyOtp`). Google comes later.
- `join/[slug]` and `join/index` (code entry): calls `join_gym`.
- `(tabs)/` for the active gym: `index` (home with membership, QR and next class), `classes`, `workouts`, `progress`, `profile` (gym switcher, sign out).
- `staff/scan`: only for the owner, admin and staff roles.
- The active gym is kept in a React context and persisted to storage.

**Payments:** the app calls `razorpay-create-order`, then opens `RazorpayCheckout.open`. The webhook is the source of truth, and the app then refetches.

## Build phases
0. **Setup:**
   - Restructure into the monorepo and scaffold the Expo app.
   - Move the shared types into `packages/shared`.
   - Pick the backend: hosted Supabase, or local through WSL.
1. **Mobile foundation:**
   - Supabase client and OTP auth.
   - Join by link, install referrer or code.
   - Active-gym context and gym switcher, tabs shell, profile.
2. **Memberships:** plans, subscriptions, manual payments, admin CRUD, the member membership screen, and the expiry cron job.
3. **Payments:** Edge Functions, Razorpay keys in the admin panel, a dev build with Razorpay checkout, and an idempotent webhook.
4. **Check-in:** the token RPCs, the rotating QR, staff scan mode, the admin webcam scanner, and a live counter.
5. **Classes:** booking RPCs with the waitlist, the admin calendar, and the member schedule.
6. **Workouts & progress:** the plan builder, the logger, metrics and charts.
7. **Launch:**
   - Push notifications with `expo-notifications`, and reports.
   - EAS Build to Play internal testing, then production.
   - iOS through EAS Build and TestFlight.
   - EAS Update for over-the-air fixes.

## Verification
- **Web:** typecheck, lint and build in `apps/web`.
- **Mobile:** `tsc --noEmit`, `expo lint`, and `npx expo export --platform android` (the bundle compiles). Run in Expo Go on a phone or emulator for the flows that don't involve Razorpay.
- **Backend:** `supabase db reset` loads the seed, followed by RLS isolation tests and a booking concurrency test.
- **Deep links:** `npx uri-scheme open https://<domain>/join/ironfit --android`, or `adb shell am start -d ...`, opens the Join screen. Validate `assetlinks.json` too.
- **Payments:** Razorpay test mode end to end. Replaying the webhook must be a no-op.
