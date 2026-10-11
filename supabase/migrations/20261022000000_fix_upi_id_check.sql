-- The upi_id check used {2,256}, but Postgres regexes allow repeat counts up
-- to 255 only, so saving any UPI ID failed with "invalid repetition count(s)".
-- Real UPI handles are far shorter; 64 matches the app's validation.
alter table public.gyms drop constraint if exists gyms_upi_id_check;
alter table public.gyms
  add constraint gyms_upi_id_check check (upi_id ~ '^[A-Za-z0-9._-]{2,64}@[A-Za-z0-9]{2,64}$');
