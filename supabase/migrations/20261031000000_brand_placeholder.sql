-- The product's name lives in one place in the code (packages/shared/src/brand.ts).
-- Renewal messages say {app} instead of a fixed name, filled in when sent, so a
-- rename doesn't leave old names in saved messages.
alter table public.gyms
  alter column renewal_message set default
    'Hi {name}, your {gym} membership ends on {date}. Renew at the front desk or in the {app} app.';

update public.gyms
set renewal_message = replace(replace(renewal_message, 'GOS app', '{app} app'), 'GymOS app', '{app} app')
where renewal_message like '%GOS app%';
