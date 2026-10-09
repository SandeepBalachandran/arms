# GymOS

Multi-tenant gym platform: a web admin panel for gym owners and staff, and an
Android/iOS app for members. Gym owners share a join link on WhatsApp; it opens
the app (or the Play Store) and joins their gym.

| Path | What |
| --- | --- |
| `apps/web` | Next.js admin panel, marketing site, `/join/<slug>` install page |
| `apps/mobile` | Expo (React Native) member app |
| `packages/shared` | `@gymos/shared`: database types, roles, gym-code rules |
| `supabase` | Migrations, email templates (shared backend) |
| `docs/PLAN.md` | Product and build plan |

## Setup

```bash
npm install                      # installs every workspace
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env.local
```

Fill both env files with the same Supabase project (URL + publishable key).
For database commands, also put `SUPABASE_DB_PASSWORD` in `apps/web/.env.local`
(never in the mobile env file).

```bash
npm run db:push      # apply new supabase/migrations to the hosted project
npm run db:types     # regenerate packages/shared/src/database.types.ts
```

Copy `supabase/templates/*.html` into Supabase → Authentication → Email
Templates so sign-in emails include the 6-digit code.

## Run

```bash
npm run web       # http://localhost:3000
npm run mobile    # Expo dev server; scan the QR with Expo Go
npm run typecheck
npm run lint
```

After adding a migration: `npm run db:push`, then `npm run db:types`.

## Join links

- Web: `https://<domain>/join/<slug>` shows the gym and a Play Store button
  carrying `referrer=gym=<slug>`; the app reads it on first launch.
- Android App Links: set `EXPO_PUBLIC_APP_LINK_HOST` (mobile) and
  `ANDROID_SHA256_CERT_FINGERPRINTS` (web, from `eas credentials -p android`).
- In development: `npx uri-scheme open gymos://join/<slug> --android`.
