# GymOS mobile (Expo)

Member app. See the root README for setup.

- Routes: `src/app` (expo-router). `sign-in` → `join/*` → `(gym)` tabs, gated in `src/app/_layout.tsx`.
- Data: `src/lib/supabase.ts` (session in expo-sqlite localStorage), queries in `src/lib/*`.
- Sign-in uses 6-digit email codes; the Supabase email templates must include `{{ .Token }}` (see `supabase/templates`).
- Native modules outside Expo Go (Razorpay, later) need a dev build: `npx eas-cli@latest build --profile development`.
