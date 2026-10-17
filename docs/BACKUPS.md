# Backups

Supabase's free plan keeps no backups, so a GitHub Action makes one every night:
[`.github/workflows/db-backup.yml`](../.github/workflows/db-backup.yml).

- **When:** 03:00 IST every night, or any time from GitHub → Actions → "Nightly database backup" → **Run workflow**.
- **What:** the whole database (logins, roles, tables, data) and every storage file (gym logos, profile photos, exercise photos).
- **Where:** a download on that night's run, named `squatpress-YYYY-MM-DD`. Each is kept **30 days**, so there are always about 30 copies.
- **Safety:** this repo is public, so each copy is encrypted with your passphrase (AES-256). Without the passphrase it can't be opened, by anyone, including you.

## One-time setup

1. **Make a passphrase.** Use 5–6 random words or 30+ characters. Save it in your password manager **and** on paper. If you lose it, the backups are useless.
2. In GitHub, open the repo → **Settings → Secrets and variables → Actions → New repository secret**, and add these four:

   | Name | Value |
   |---|---|
   | `SUPABASE_DB_URL` | The same value as `SUPABASE_DB_URL` in `apps/web/.env.local` (Supabase → Connect → Session pooler, with the password filled in) |
   | `SUPABASE_URL` | `NEXT_PUBLIC_SUPABASE_URL` from `apps/web/.env.local` |
   | `SUPABASE_SECRET_KEY` | `SUPABASE_SECRET_KEY` from `apps/web/.env.local` |
   | `BACKUP_PASSPHRASE` | Your passphrase from step 1 |

3. **Test it:** Actions → "Nightly database backup" → **Run workflow**. In about 2 minutes it should finish green with a `squatpress-…` download at the bottom of the run page.
4. **Turn on failure emails:** GitHub → your profile → Settings → Notifications → Actions → "Send notifications for failed workflows only".

**Keep it running:** GitHub pauses scheduled workflows in a repo with no commits for 60 days. If you get the email saying so, click "Enable workflow" in Actions.

## Restore

You'll need the passphrase and Git Bash, which includes `gpg`.

1. **Download** the copy you want from its run page, then unzip it to get `squatpress-YYYY-MM-DD.tar.gz.gpg`.
2. **Decrypt and unpack:**
   ```sh
   gpg --decrypt squatpress-YYYY-MM-DD.tar.gz.gpg | tar xz
   ```
   This gives you `backup/roles.sql`, `backup/schema.sql`, `backup/data.sql` and `backup/storage/<bucket>/…`.
3. **Load the database** into a new, empty Supabase project, using its session-pooler string. You need `psql` (PostgreSQL 17 client):
   ```sh
   psql --single-transaction --variable ON_ERROR_STOP=1 \
     --file backup/roles.sql --file backup/schema.sql \
     --command 'SET session_replication_role = replica' \
     --file backup/data.sql \
     --dbname "postgresql://postgres.<new-ref>:<password>@<pooler-host>:5432/postgres"
   ```
4. **Storage files:** create the same buckets in the new project, then upload the folders in `backup/storage/` (Dashboard → Storage → upload, or ask for a small upload script).
5. **Point the app at the new project:** update the Supabase URL and keys in Vercel and in `apps/web/.env.local` / `apps/mobile/.env.local`, then rebuild the APK.

**Getting back one deleted record:** don't restore the whole database. Unpack the copy, search `backup/data.sql` for the row, and re-add it by hand in the Supabase table editor.

## Moving to Supabase Pro later

Pro keeps 7 days of daily backups itself. Keep this Action anyway: it's a second copy outside Supabase, and it keeps 30 days.
