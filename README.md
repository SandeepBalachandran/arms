# GOS

Multi-tenant gym platform: a web admin panel for gym owners and staff, and an
Android/iOS app for members. Gym owners share a join link on WhatsApp; it opens
the app (or the Play Store) and joins their gym.

| Path | What |
| --- | --- |
| `apps/web` | Next.js admin panel, marketing site, `/join/<slug>` install page |
| `apps/mobile` | Expo (React Native) member app |
| `packages/shared` | `@gymos/shared`: database types, roles, gym-code rules |
| `supabase` | Migrations, email templates (shared backend) |
| `docs/HOW-IT-WORKS.md` | How everything works: product flows, architecture, data, security, running and releasing |
| `docs/PLAN.md` | Milestones done and what’s next |
| `docs/COSTS.md` | What it costs to run GOS: hosting, database, messaging, domains, app stores, and hidden charges |
| `docs/MARKET.md` | Competitors in India and Kerala, what makes GOS different, gaps, pricing |

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

## Tests

```bash
npm test            # everything
npm run test:unit   # shared logic: hours, money, dates, UPI, import, nutrition (seconds, no network)
npm run test:db     # database rules and permissions, per role (about 1.5 minutes)
```

- **Logic tests** (`tests/unit`) check the pure functions in `packages/shared` and the member import.
- **Database tests** (`tests/db`) sign in as an owner, admin, staff, trainer, two members and an outsider, then check what each can see and do:
  - members and payments, UPI and roles
  - check-in rules (hours, poster, location)
  - classes, personal training and workouts
  - nutrition privacy
  - settings saves
  - deleting and restoring a gym
- **Where they run:** against the Supabase project in `apps/web/.env.local`.
  - **What they create:** a throwaway gym (`test-…`) and fresh `t….@gymos.test` accounts.
  - **What they never touch:** any other gym or account.
  - **Clean-up:** everything is deleted afterwards, and leftovers from a crashed run are removed on the next one.
  - **What they need:** `SUPABASE_SECRET_KEY`, to create the test accounts.
- **Once real gyms use the project,** point the database tests at a separate test project instead.

## Join links

- Web: `https://<domain>/join/<slug>` shows the gym and a Play Store button
  carrying `referrer=gym=<slug>`; the app reads it on first launch.
- Android App Links: set `EXPO_PUBLIC_APP_LINK_HOST` (mobile) and
  `ANDROID_SHA256_CERT_FINGERPRINTS` (web, from `eas credentials -p android`).
- In development: `npx uri-scheme open gymos://join/<slug> --android`.
