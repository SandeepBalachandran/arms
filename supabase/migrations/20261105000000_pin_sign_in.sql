-- Phone number + PIN sign-in for members without an email (see
-- packages/shared/src/sign-in.ts and apps/web/src/app/api/auth/pin).

-- When the front desk last set this person's PIN (shown on the member page).
alter table public.profiles add column pin_set_at timestamptz;

-- Wrong-PIN counter per phone number: 5 wrong tries lock that number for
-- 15 minutes. Only the server (service role) reads or writes it.
create table public.pin_attempts (
  phone text primary key,
  failures integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.pin_attempts enable row level security;
revoke all on public.pin_attempts from anon, authenticated;
