-- The product is now called GOS. Update the default renewal message, and
-- existing gyms that still use the untouched default (custom ones are kept).
alter table public.gyms
  alter column renewal_message set default
    'Hi {name}, your {gym} membership ends on {date}. Renew at the front desk or in the GOS app.';

update public.gyms
set renewal_message = 'Hi {name}, your {gym} membership ends on {date}. Renew at the front desk or in the GOS app.'
where renewal_message = 'Hi {name}, your {gym} membership ends on {date}. Renew at the front desk or in the GymOS app.';
