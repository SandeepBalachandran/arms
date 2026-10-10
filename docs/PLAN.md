# GOS — Plan and Milestones

Multi-tenant gym SaaS: a **Next.js web admin** for gym owners and staff, and an **Expo (React Native) member app** that gyms share on WhatsApp. One shared app; each member joins their gym by link or gym code.

Repo: https://github.com/SandeepBalachandran/arms

## Decisions

| Area | Decision |
|---|---|
| Product | One shared app ("GOS") for all gyms; gyms share a join link on WhatsApp |
| Admin | Stays in the browser (Next.js), works on phones with a bottom nav |
| Member app | React Native with Expo (not Flutter): same TypeScript/React, shared types, EAS builds iOS from Windows |
| Platforms | Android first, iOS next |
| Backend | Hosted Supabase (Postgres, Auth, RLS, RPCs, pg_cron, Realtime) |
| Payments | **UPI-first, no gateway.** Members pay the gym's UPI ID from the app and staff confirm. Razorpay was dropped: no fees, no KYC |
| Features | Check-in, classes, workouts and personal training are **optional per gym** ("no hard strict rule") |
| Configuration | Nothing hard-coded: every gym setting is editable, with Indian defaults (+91, INR, Asia/Kolkata, renewal template) |
| Look | Light theme by default, dark available |

## Repo layout (npm workspaces)

```
apps/web         Next.js 16 admin, landing page, /join/[slug], assetlinks.json
apps/mobile      Expo SDK 57 member app (expo-router, react-query, Reanimated)
packages/shared  @gymos/shared: generated DB types, zod schemas, shared logic
supabase/        migrations (applied to the hosted project), templates, config
scripts/         db.mjs (push migrations / generate types), seed-demo.mjs
docs/PLAN.md     this file
```

Conventions: money in paise; dates as `YYYY-MM-DD` in the gym's timezone; secrets only on the server (`SUPABASE_SECRET_KEY` and the DB password never reach the mobile app).

## Demo data

- Gym **Demo Fitness**, code `demo-fitness`.
- One account per role (`node scripts/seed-demo.mjs` creates them):

| Role | Email | Password |
|---|---|---|
| Owner | `admin@gymos.test` | `GOS-admin-2026` |
| Admin | `manager@gymos.test` | `GOS-manager-2026` |
| Staff | `staff@gymos.test` | `GOS-staff-2026` |
| Trainer | `trainer@gymos.test` | `GOS-trainer-2026` |
| Member | `member@gymos.test` | `GOS-member-2026` |

- Has two plans, Zumba and Yoga classes, PT turned on with two packages, and the member on Monthly PT.

---

## Milestones completed

### M1. Foundation — `b1df215`
- Multi-tenant schema: profiles, gyms, gym members with roles (owner, admin, staff, trainer, member) and RLS helpers.
- Web: sign-in, gym registration, admin shell, `/join/[slug]` install page, `assetlinks.json`.

### M2. Monorepo and member app — `8e60f77`
- npm workspaces with `apps/web`, `apps/mobile` and `packages/shared`.
- Expo app: email code / password sign-in, join by link, install referrer or gym code, gym switcher, tabs.

### M3. Memberships and plans — `a51c548`
- Plans, subscriptions, manual payments with receipt numbers.
- Expiry job (pg_cron, hourly).
- Admin CRUD and the member's membership screen.

### M4. UPI payments (no gateway) — `d7a1da7`
- Members pay the gym's UPI ID from the app and tap "I've paid" with a reference.
- Staff confirm or reject on the Payments page; confirming starts the membership.

### M5. Optional check-in — `b6968e4`
- Member QR (signed, rotates every 2 minutes), staff scan mode, self check-in, desk check-in by name.
- Live count on the dashboard.

### M6. Optional classes — `66b4255`
- Class types, weekly series, booking with waitlist and auto-promotion, cancellation cutoff, attendance marking.

### M7. Optional workouts and progress — `37b704c`
- Exercise library (41 built in), trainer-built plans assigned to members.
- Workout logger, body metrics, charts and personal records.

### M8. Live backend and demo data — `6ff5c5c`, `f764c4b`
- Migrations applied to hosted Supabase; types generated from the live schema.
- Demo seed with owner and member accounts.

### M9. Everything configurable, Indian defaults — `cb1e69d`
- Settings for: gym profile, timezone, currency, phone country code, expiry warning, renewal message template, receipt prefix, payment methods, join approval, check-in, classes and workouts.

### M10. Look and feel — `b19396c`, `e6a908f`
- Light/dark themes (light default), splash screen, app icons, favicon.
- Admin header with notifications and profile menu.
- Admin works on phones with a bottom navigation bar.

### M11. Members and plans admin — `e02a873`, `8d1da8d`, `3c73bb7`
- Add members (email or phone), approve join requests.
- Edit details from the table or the member page.
- Member page: stats, history tabs, staff notes, WhatsApp renewal reminder.
- Plans as cards.
- Popups close only with ✕ or Esc, never on a backdrop click.

### M12. Feedback UX — `5ea036e`
- react-hot-toast for every save and action, with real error messages.
- Confirmations on destructive actions; Radix tooltips.
- Class wording only shown when Classes is on.

### M13. Classes admin redesign — `b3b6ab8`
- 7-day calendar (day list on phones), week stats, fill bars and waitlist counts.
- Schedule and class-type popups with a live summary; first-time setup guide.

### M14. Member app on the web — `4221172`
- The Expo app runs in a browser (`npm run mobile:web`) for quick testing.

### M15. Opening hours and personal training — `1c5914c`
- **Opening hours:** a morning and an evening session per weekday, plus a note. Members see "Open now / opens at".
- **Personal training (optional):**
  - Packages, priced as a pack of sessions or unlimited for a period.
  - Sell a package with a receipt, assign a trainer, log sessions (limits enforced).
  - "Running low" flags and a list of recently ended clients for renewal.
  - Trainers see their own clients.
  - Members see their PT progress in the app.

### M16. Member app redesign — `7dee524`
- Lime and olive look with a floating dark tab bar.
- Home: greeting, membership ring, "Today" hero card and Explore tiles.
- Welcome slides before sign-in; icons from lucide.

### M17. Infographics and motion — `4f65899`
- Weekly activity chart with a streak, gym-hours timeline, membership timeline, PT session dots.
- Staggered entrances, press feedback, animated ring and tab bar.
- All motion respects "reduce motion".

### M18. Build setup — `85ace06`
- EAS profiles: `preview` builds an installable APK, `production` builds an AAB for Google Play.
- Supports Android 7.0+ (minSdk 24) and targets Android 16 (SDK 36).

### M19. Polish, roles and rename
- Product renamed from GymOS to **GOS** (visible names only; internal IDs unchanged).
- Poppins on web and mobile; redesigned sign-in and register pages; role changes autosave.
- One demo account per role.
- **Delete gym** (owners, Settings): type-to-confirm, CSV download of members and payments, 30-day restore from the admin home, then a daily job removes the gym's data.

---

## Next up

### Done since M19
- **Import members** (Members → Import): CSV template or paste from a spreadsheet, a checked preview, batch import with progress. Optional current plan with last paid date, paid-until date and amount.

- **QR poster check-in** (optional, Settings): members scan a printed poster; optional location check with a radius; printable poster page with a "New code" to retire old posters.

- **Nutrition coaching (phase 1)** (optional, Settings → Nutrition):
  - PT clients (or all members) log meals from about 140 built-in Indian and Kerala foods, gym-added foods, or quick calories, plus water.
  - The trainer sets calorie and protein targets ("Suggest" uses Mifflin–St Jeor), sees a 7-day table and comments.
  - The PT page flags clients who aren't logging or are low on protein.
  - Food logs are visible only to the member, their trainer and owners/admins. Needs migration `20261020000000_nutrition.sql`.

### Follow-ups
- [ ] **Nutrition phase 2:** diet plan templates the trainer assigns, "Ate as planned" per meal, meal photos, meal reminders.
- [ ] **To compete** (see MARKET.md): enquiry and lead tracking, automatic WhatsApp reminders, GST invoices, Malayalam in the app. Later: diet plans, reports, staff attendance, biometric integration.
- [ ] Plans billed by calendar month (1st to last day) as well as by number of days.

### Waiting to apply
- [ ] `npm run db:push` for `20261019000000_rename_gos.sql`, `20261019010000_delete_gym.sql` and `20261019020000_poster_checkin.sql`, `20261020000000_nutrition.sql`, then `npm run db:types`. The direct DB host is IPv6-only; on IPv4 networks set `SUPABASE_DB_URL` to the session pooler string.

### Decided later (on hold)
- [ ] Roles: co-owners, Admin renamed Manager, Front desk without revenue or payment edits, trainers without member phone numbers.

### In progress
- [ ] **First APK build:** log in to Expo, set the `EXPO_PUBLIC_*` variables on EAS, then run `eas build -p android --profile preview`.

### Requested, not built yet
- [ ] **Win-back campaign:**
  - A list of lapsed members (e.g. plan ended more than 30 days ago).
  - Send them an offer by WhatsApp: free tap-to-send first, WhatsApp Business API later (paid, Meta-approved templates).
- [ ] **Offer announcements via WhatsApp and SMS** to all or filtered members. SMS in India needs DLT registration and a provider such as MSG91.
- [ ] **Tenure:** show "member for 2 yrs 3 mos" and the number of renewals.
- [ ] **Attendance report:** monthly visits per member and an inactive-members list.

### Ideas raised along the way
- [ ] Gym photo uploads (gym, trainers, classes) to use in the app's hero cards.
- [ ] Detail screen for a workout day or class (Details / Start), from the design mock-up.
- [ ] Charts and motion in the admin dashboard (revenue, attendance).
- [ ] Members buying PT by UPI in the app; trainer commission tracking.

### Launch
- [ ] Deploy the web admin to a real domain, so join links open the app (App Links).
- [ ] Push notifications: renewal reminders, class changes, payment confirmed.
- [ ] Reports: revenue, renewals, attendance.
- [ ] Google Play: internal testing, then production (one-time US$25 developer account).
- [ ] iOS through EAS Build and TestFlight; EAS Update for over-the-air fixes.

## Verification (each milestone)

- **Web:** `tsc --noEmit` and eslint in `apps/web`.
- **Mobile:** `tsc --noEmit` and `expo lint` in `apps/mobile`.
- **Real use:** click-tested in headless Edge against the hosted database, with screenshots at desktop and phone sizes. The member app is tested in the browser build.
- **Database:** migrations pushed with `npm run db:push`, types regenerated with `npm run db:types`; RPC permission checks tested live.
