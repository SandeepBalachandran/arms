-- Optional nutrition coaching. A gym turns it on in Settings; PT clients log
-- what they eat against calorie and protein targets their trainer sets (or
-- every member, if the gym allows). Food logs are health data: only the
-- member, their active PT trainer and the gym's owner/admin can see them.

alter table public.gyms
  add column nutrition_enabled boolean not null default false,
  add column nutrition_all_members boolean not null default false;

create type public.meal_slot as enum ('early', 'breakfast', 'lunch', 'snack', 'dinner');
create type public.food_type as enum ('veg', 'egg', 'nonveg');
create type public.nutrition_goal as enum ('lose', 'maintain', 'gain');

-- Who can see and coach a member's nutrition --------------------------------------

-- The member, an active (or ended in the last week) PT trainer of theirs, or
-- the gym's owner/admin. Front-desk staff are deliberately left out.
create function public.can_coach(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.gym_members m
    where m.id = p_member_id
      and (
        m.user_id = auth.uid()
        or public.auth_role_in(m.gym_id) in ('owner', 'admin')
        or exists (
          select 1 from public.pt_subscriptions s
          join public.gym_members t on t.id = s.trainer_member_id
          where s.member_id = m.id and s.status = 'active'
            and s.ends_on >= current_date - 7 and t.user_id = auth.uid()
        )
      )
  )
$$;

-- The caller's membership row in a gym (for authored rows).
create function public.my_member_id(p_gym_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.gym_members where gym_id = p_gym_id and user_id = auth.uid() and status = 'active'
$$;

-- Tables ------------------------------------------------------------------------------

-- Per-membership body details used for suggested targets, plus preferences.
create table public.nutrition_profiles (
  member_id uuid primary key references public.gym_members (id) on delete cascade,
  gym_id uuid not null references public.gyms (id) on delete cascade,
  consent_at timestamptz,
  height_cm numeric(5, 1) check (height_cm between 100 and 250),
  birth_year integer check (birth_year between 1920 and 2020),
  sex text check (sex in ('male', 'female')),
  activity text not null default 'moderate' check (activity in ('light', 'moderate', 'active')),
  food_pref public.food_type,
  notes text check (length(notes) <= 500), -- allergies, conditions (diabetes, thyroid…)
  updated_at timestamptz not null default now()
);

-- Built-in foods have gym_id null; gyms add their own. Values are per serving.
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms (id) on delete cascade,
  name text not null check (length(name) between 2 and 80),
  name_ml text check (length(name_ml) <= 80),
  category text not null default 'other',
  serving_label text not null check (length(serving_label) between 1 and 40),
  serving_g numeric(6, 1),
  kcal integer not null check (kcal between 0 and 3000),
  protein_g numeric(5, 1) not null default 0 check (protein_g between 0 and 300),
  carbs_g numeric(5, 1) not null default 0 check (carbs_g between 0 and 500),
  fat_g numeric(5, 1) not null default 0 check (fat_g between 0 and 300),
  food_type public.food_type not null default 'veg',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index foods_gym_idx on public.foods (gym_id);

create table public.nutrition_targets (
  member_id uuid primary key references public.gym_members (id) on delete cascade,
  gym_id uuid not null references public.gyms (id) on delete cascade,
  goal public.nutrition_goal not null default 'maintain',
  kcal integer not null check (kcal between 800 and 6000),
  protein_g integer not null check (protein_g between 20 and 400),
  set_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- One row per thing eaten. Name and values are copied at log time so later
-- edits to a food never change history.
create table public.food_logs (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  member_id uuid not null references public.gym_members (id) on delete cascade,
  logged_on date not null,
  meal public.meal_slot not null,
  food_id uuid references public.foods (id) on delete set null,
  name text not null check (length(name) between 1 and 80),
  servings numeric(4, 2) not null default 1 check (servings > 0 and servings <= 20),
  kcal integer not null check (kcal between 0 and 10000),
  protein_g numeric(5, 1) not null default 0,
  carbs_g numeric(5, 1) not null default 0,
  fat_g numeric(5, 1) not null default 0,
  created_at timestamptz not null default now()
);
create index food_logs_member_day_idx on public.food_logs (member_id, logged_on);

create table public.water_logs (
  member_id uuid not null references public.gym_members (id) on delete cascade,
  gym_id uuid not null references public.gyms (id) on delete cascade,
  logged_on date not null,
  glasses integer not null default 0 check (glasses between 0 and 30),
  primary key (member_id, logged_on)
);

create table public.nutrition_comments (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  member_id uuid not null references public.gym_members (id) on delete cascade,
  day date not null,
  author_member_id uuid references public.gym_members (id) on delete set null,
  body text not null check (length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index nutrition_comments_member_idx on public.nutrition_comments (member_id, created_at desc);

-- RLS -----------------------------------------------------------------------------------

alter table public.nutrition_profiles enable row level security;
alter table public.foods enable row level security;
alter table public.nutrition_targets enable row level security;
alter table public.food_logs enable row level security;
alter table public.water_logs enable row level security;
alter table public.nutrition_comments enable row level security;

-- Every row's gym must be the member's gym.
create function public.member_in_gym(p_member_id uuid, p_gym_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.gym_members where id = p_member_id and gym_id = p_gym_id)
$$;

create policy "nutrition_profiles_select" on public.nutrition_profiles for select using (public.can_coach(member_id));
create policy "nutrition_profiles_write" on public.nutrition_profiles for all
  using (public.can_coach(member_id))
  with check (public.can_coach(member_id) and public.member_in_gym(member_id, gym_id));

create policy "foods_select" on public.foods for select using (
  gym_id is null or public.my_member_id(gym_id) is not null
);
create policy "foods_write" on public.foods for all
  using (gym_id is not null and public.is_gym_team(gym_id))
  with check (gym_id is not null and public.is_gym_team(gym_id));

create policy "nutrition_targets_select" on public.nutrition_targets for select using (public.can_coach(member_id));
create policy "nutrition_targets_write" on public.nutrition_targets for all
  using (public.can_coach(member_id))
  with check (public.can_coach(member_id) and public.member_in_gym(member_id, gym_id));

-- Members log their own food; coaches read it.
create policy "food_logs_select" on public.food_logs for select using (public.can_coach(member_id));
create policy "food_logs_write" on public.food_logs for all
  using (public.is_my_membership(member_id))
  with check (public.is_my_membership(member_id) and public.member_in_gym(member_id, gym_id));

create policy "water_logs_select" on public.water_logs for select using (public.can_coach(member_id));
create policy "water_logs_write" on public.water_logs for all
  using (public.is_my_membership(member_id))
  with check (public.is_my_membership(member_id) and public.member_in_gym(member_id, gym_id));

create policy "nutrition_comments_select" on public.nutrition_comments for select using (public.can_coach(member_id));
create policy "nutrition_comments_insert" on public.nutrition_comments for insert with check (
  public.can_coach(member_id)
  and public.member_in_gym(member_id, gym_id)
  and author_member_id = public.my_member_id(gym_id)
);
create policy "nutrition_comments_delete" on public.nutrition_comments for delete using (
  author_member_id = public.my_member_id(gym_id)
);

-- Built-in foods ----------------------------------------------------------------------------
-- Approximate values per home portion (ICMR-NIN IFCT averages and common
-- recipes). The app shows them with "≈"; gyms can add their own.

insert into public.foods (name, name_ml, category, serving_label, serving_g, kcal, protein_g, carbs_g, fat_g, food_type) values
-- Kerala breakfast & breads
('Puttu', 'പുട്ട്', 'breakfast', '1 piece', 100, 170, 3.5, 37, 1, 'veg'),
('Wheat puttu', 'ഗോതമ്പ് പുട്ട്', 'breakfast', '1 piece', 100, 160, 5, 32, 1.5, 'veg'),
('Ragi puttu', 'റാഗി പുട്ട്', 'breakfast', '1 piece', 100, 150, 3, 32, 1, 'veg'),
('Appam', 'അപ്പം', 'breakfast', '1 piece', 60, 120, 2, 25, 1.5, 'veg'),
('Idiyappam', 'ഇടിയപ്പം', 'breakfast', '1 piece', 40, 70, 1.2, 15, 0.2, 'veg'),
('Dosa', 'ദോശ', 'breakfast', '1 medium', 80, 135, 3, 22, 4, 'veg'),
('Masala dosa', 'മസാല ദോശ', 'breakfast', '1 piece', 200, 330, 6, 45, 14, 'veg'),
('Ghee roast dosa', 'നെയ്റോസ്റ്റ്', 'breakfast', '1 piece', 120, 260, 4, 30, 14, 'veg'),
('Idli', 'ഇഡ്ഡലി', 'breakfast', '1 piece', 40, 60, 2, 12, 0.3, 'veg'),
('Uthappam', 'ഊത്തപ്പം', 'breakfast', '1 piece', 120, 200, 5, 32, 6, 'veg'),
('Upma', 'ഉപ്പുമാവ്', 'breakfast', '1 cup', 180, 250, 6, 35, 9, 'veg'),
('Pathiri', 'പത്തിരി', 'breakfast', '1 piece', 35, 75, 1.5, 16, 0.5, 'veg'),
('Porotta', 'പൊറോട്ട', 'bread', '1 piece', 90, 260, 5, 35, 11, 'veg'),
('Chapati', 'ചപ്പാത്തി', 'bread', '1 piece', 40, 105, 3, 18, 3, 'veg'),
('Phulka (no oil)', 'ഫുൽക്ക', 'bread', '1 piece', 30, 80, 3, 16, 0.5, 'veg'),
('Poori', 'പൂരി', 'bread', '1 piece', 25, 100, 1.5, 12, 5, 'veg'),
('Bread, white', 'ബ്രെഡ്', 'bread', '1 slice', 28, 70, 2, 13, 1, 'veg'),
('Bread, brown', 'ബ്രൗൺ ബ്രെഡ്', 'bread', '1 slice', 28, 70, 3, 12, 1, 'veg'),
('Oats, cooked in water', 'ഓട്സ്', 'breakfast', '1 bowl', 240, 150, 5, 27, 3, 'veg'),
('Oats with milk', 'പാലിൽ ഓട്സ്', 'breakfast', '1 bowl', 250, 250, 10, 35, 7, 'veg'),
('Muesli with milk', 'മ്യൂസ്ലി', 'breakfast', '1 bowl', 250, 300, 10, 45, 8, 'veg'),
('Cornflakes with milk', 'കോൺഫ്ലേക്സ്', 'breakfast', '1 bowl', 250, 220, 7, 38, 4, 'veg'),
('Kozhukatta', 'കൊഴുക്കട്ട', 'breakfast', '1 piece', 60, 110, 2, 20, 2.5, 'veg'),
('Ela ada', 'ഇലയട', 'snack', '1 piece', 70, 130, 2, 25, 3, 'veg'),
-- Rice
('White rice', 'ചോറ്', 'rice', '1 cup', 150, 200, 4, 44, 0.5, 'veg'),
('Kerala matta rice', 'കുത്തരി ചോറ്', 'rice', '1 cup', 150, 210, 5, 45, 1, 'veg'),
('Brown rice', 'ബ്രൗൺ റൈസ്', 'rice', '1 cup', 150, 215, 5, 45, 1.8, 'veg'),
('Kanji (rice gruel)', 'കഞ്ഞി', 'rice', '1 bowl', 300, 150, 3, 33, 0.5, 'veg'),
('Curd rice', 'തൈര് സാദം', 'rice', '1 cup', 200, 250, 7, 38, 7, 'veg'),
('Ghee rice', 'നെയ്ച്ചോറ്', 'rice', '1 cup', 150, 300, 5, 45, 11, 'veg'),
('Veg fried rice', 'വെജ് ഫ്രൈഡ് റൈസ്', 'rice', '1 plate', 300, 450, 10, 70, 14, 'veg'),
('Chicken biryani', 'ചിക്കൻ ബിരിയാണി', 'rice', '1 plate', 350, 600, 28, 70, 22, 'nonveg'),
('Beef biryani', 'ബീഫ് ബിരിയാണി', 'rice', '1 plate', 350, 650, 30, 70, 26, 'nonveg'),
('Egg biryani', 'മുട്ട ബിരിയാണി', 'rice', '1 plate', 350, 520, 18, 72, 18, 'egg'),
('Chicken mandi', 'ചിക്കൻ മന്തി', 'rice', '1 plate', 450, 900, 50, 100, 30, 'nonveg'),
('Tapioca (kappa), boiled', 'കപ്പ', 'rice', '1 cup', 150, 240, 2, 57, 0.5, 'veg'),
-- Curries & sides (veg)
('Kadala curry', 'കടല കറി', 'curry', '1 katori', 150, 210, 9, 25, 8, 'veg'),
('Green gram curry (cherupayar)', 'ചെറുപയർ കറി', 'curry', '1 katori', 150, 180, 10, 25, 4, 'veg'),
('Sambar', 'സാമ്പാർ', 'curry', '1 katori', 150, 130, 6, 18, 4, 'veg'),
('Rasam', 'രസം', 'curry', '1 katori', 150, 60, 2, 8, 2, 'veg'),
('Parippu curry (dal)', 'പരിപ്പ് കറി', 'curry', '1 katori', 150, 150, 8, 20, 4, 'veg'),
('Dal tadka', 'ദാൽ', 'curry', '1 katori', 150, 180, 9, 22, 6, 'veg'),
('Avial', 'അവിയൽ', 'curry', '1 katori', 150, 150, 3, 12, 10, 'veg'),
('Cabbage thoran', 'കാബേജ് തോരൻ', 'curry', '1 katori', 100, 110, 3, 10, 7, 'veg'),
('Beans thoran', 'ബീൻസ് തോരൻ', 'curry', '1 katori', 100, 110, 3, 10, 7, 'veg'),
('Olan', 'ഓലൻ', 'curry', '1 katori', 150, 120, 2, 10, 8, 'veg'),
('Erissery', 'എരിശ്ശേരി', 'curry', '1 katori', 150, 180, 5, 22, 8, 'veg'),
('Kootu curry', 'കൂട്ടുകറി', 'curry', '1 katori', 150, 180, 6, 22, 7, 'veg'),
('Moru curry (pulissery)', 'മോരുകറി', 'curry', '1 katori', 150, 90, 3, 8, 5, 'veg'),
('Veg stew', 'വെജ് സ്റ്റ്യൂ', 'curry', '1 katori', 150, 160, 3, 14, 10, 'veg'),
('Veg kurma', 'വെജ് കുറുമ', 'curry', '1 katori', 150, 180, 4, 15, 12, 'veg'),
('Mixed veg sabzi', 'വെജ് കറി', 'curry', '1 katori', 150, 120, 3, 12, 7, 'veg'),
('Aloo sabzi', 'ഉരുളക്കിഴങ്ങ് കറി', 'curry', '1 katori', 150, 160, 2, 20, 8, 'veg'),
('Rajma', 'രാജ്മ', 'curry', '1 katori', 150, 200, 10, 28, 5, 'veg'),
('Chole', 'ചോലെ', 'curry', '1 katori', 150, 240, 10, 30, 9, 'veg'),
('Palak paneer', 'പാലക് പനീർ', 'curry', '1 katori', 150, 250, 12, 8, 19, 'veg'),
('Paneer butter masala', 'പനീർ ബട്ടർ മസാല', 'curry', '1 katori', 150, 320, 13, 12, 25, 'veg'),
('Soya chunks curry', 'സോയ കറി', 'curry', '1 katori', 150, 160, 16, 12, 5, 'veg'),
('Salad (cucumber, tomato, onion)', 'സാലഡ്', 'curry', '1 cup', 150, 30, 1, 6, 0, 'veg'),
('Sprouts salad', 'മുളപ്പിച്ച പയർ', 'curry', '1 cup', 100, 100, 7, 15, 0.5, 'veg'),
-- Non-veg
('Egg, boiled', 'പുഴുങ്ങിയ മുട്ട', 'egg', '1 egg', 50, 75, 6.3, 0.6, 5, 'egg'),
('Egg white, boiled', 'മുട്ടയുടെ വെള്ള', 'egg', '1 egg white', 33, 17, 3.6, 0.2, 0, 'egg'),
('Omelette (2 eggs)', 'ഓംലെറ്റ്', 'egg', '1 omelette', 120, 200, 13, 2, 15, 'egg'),
('Egg bhurji (2 eggs)', 'മുട്ട ബുർജി', 'egg', '1 serving', 130, 220, 13, 4, 17, 'egg'),
('Egg curry', 'മുട്ട കറി', 'egg', '1 egg + gravy', 150, 190, 8, 6, 15, 'egg'),
('Egg roast', 'മുട്ട റോസ്റ്റ്', 'egg', '1 egg + masala', 150, 220, 9, 8, 17, 'egg'),
('Fish curry', 'മീൻ കറി', 'nonveg', '1 piece + gravy', 150, 200, 18, 6, 12, 'nonveg'),
('Fish fry', 'മീൻ വറുത്തത്', 'nonveg', '1 piece', 80, 200, 18, 4, 12, 'nonveg'),
('Meen pollichathu', 'മീൻ പൊള്ളിച്ചത്', 'nonveg', '1 piece', 150, 250, 20, 5, 16, 'nonveg'),
('Fish, grilled', 'ഗ്രിൽഡ് ഫിഷ്', 'nonveg', '100 g', 100, 140, 24, 0, 4, 'nonveg'),
('Prawn roast', 'ചെമ്മീൻ റോസ്റ്റ്', 'nonveg', '1 katori', 100, 200, 20, 6, 10, 'nonveg'),
('Chicken curry', 'ചിക്കൻ കറി', 'nonveg', '1 katori', 150, 250, 20, 6, 16, 'nonveg'),
('Chicken roast', 'ചിക്കൻ റോസ്റ്റ്', 'nonveg', '1 katori', 150, 280, 24, 6, 18, 'nonveg'),
('Chicken fry', 'ചിക്കൻ ഫ്രൈ', 'nonveg', '1 piece', 100, 250, 20, 8, 15, 'nonveg'),
('Chicken stew', 'ചിക്കൻ സ്റ്റ്യൂ', 'nonveg', '1 katori', 150, 220, 15, 10, 14, 'nonveg'),
('Chicken breast, grilled', 'ചിക്കൻ ബ്രെസ്റ്റ്', 'nonveg', '100 g', 100, 165, 31, 0, 3.6, 'nonveg'),
('Tandoori chicken', 'തന്തൂരി ചിക്കൻ', 'nonveg', '1 quarter', 200, 260, 30, 4, 13, 'nonveg'),
('Alfaham', 'അൽഫാം', 'nonveg', '1 quarter', 200, 300, 30, 3, 18, 'nonveg'),
('Beef fry (ularthiyathu)', 'ബീഫ് ഉലർത്തിയത്', 'nonveg', '100 g', 100, 300, 26, 5, 20, 'nonveg'),
('Beef curry', 'ബീഫ് കറി', 'nonveg', '1 katori', 150, 280, 22, 6, 18, 'nonveg'),
('Mutton curry', 'മട്ടൺ കറി', 'nonveg', '1 katori', 150, 300, 22, 6, 21, 'nonveg'),
('Tuna, canned', 'ട്യൂണ', 'nonveg', '100 g', 100, 115, 26, 0, 1, 'nonveg'),
('Chicken shawarma roll', 'ഷവർമ', 'nonveg', '1 roll', 250, 450, 25, 40, 20, 'nonveg'),
('Chicken burger', 'ചിക്കൻ ബർഗർ', 'nonveg', '1 burger', 200, 450, 22, 40, 22, 'nonveg'),
-- Dairy, nuts, protein
('Milk, toned', 'പാൽ', 'dairy', '1 glass', 250, 145, 8, 12, 7.5, 'veg'),
('Milk, skimmed', 'സ്കിം മിൽക്ക്', 'dairy', '1 glass', 250, 90, 9, 13, 0.5, 'veg'),
('Curd', 'തൈര്', 'dairy', '1 katori', 100, 60, 3.5, 5, 3, 'veg'),
('Buttermilk (sambharam)', 'സംഭാരം', 'dairy', '1 glass', 250, 40, 2, 4, 1.5, 'veg'),
('Paneer', 'പനീർ', 'dairy', '100 g', 100, 265, 18, 1.2, 21, 'veg'),
('Cheese slice', 'ചീസ്', 'dairy', '1 slice', 17, 60, 4, 1, 4.5, 'veg'),
('Ghee', 'നെയ്യ്', 'dairy', '1 tsp', 5, 45, 0, 0, 5, 'veg'),
('Butter', 'വെണ്ണ', 'dairy', '1 tsp', 5, 36, 0, 0, 4, 'veg'),
('Whey protein in water', 'വേ പ്രോട്ടീൻ', 'protein', '1 scoop', 33, 120, 24, 3, 1.5, 'veg'),
('Whey protein in milk', 'പാലിൽ വേ', 'protein', '1 scoop + 1 glass milk', 283, 265, 32, 15, 9, 'veg'),
('Soya chunks, cooked', 'സോയ ചങ്ക്സ്', 'protein', '30 g dry', 30, 105, 15, 10, 0.2, 'veg'),
('Chickpeas, boiled', 'വേവിച്ച കടല', 'protein', '1 cup', 165, 270, 15, 45, 4, 'veg'),
('Peanuts', 'നിലക്കടല', 'nuts', '1 handful', 30, 170, 7.5, 5, 14, 'veg'),
('Almonds', 'ബദാം', 'nuts', '10 almonds', 12, 70, 2.5, 2.5, 6, 'veg'),
('Cashews', 'കശുവണ്ടി', 'nuts', '10 cashews', 15, 90, 3, 5, 7, 'veg'),
('Peanut butter', 'പീനട്ട് ബട്ടർ', 'nuts', '1 tbsp', 16, 95, 4, 3, 8, 'veg'),
-- Fruits
('Banana, nendran', 'നേന്ത്രപ്പഴം', 'fruit', '1 medium', 120, 140, 1.5, 35, 0.3, 'veg'),
('Banana, small (poovan/robusta)', 'ചെറുപഴം', 'fruit', '1 piece', 80, 90, 1, 23, 0.3, 'veg'),
('Apple', 'ആപ്പിൾ', 'fruit', '1 medium', 180, 95, 0.5, 25, 0.3, 'veg'),
('Orange', 'ഓറഞ്ച്', 'fruit', '1 medium', 130, 60, 1, 15, 0.2, 'veg'),
('Papaya', 'പപ്പായ', 'fruit', '1 cup', 145, 60, 0.7, 15, 0.4, 'veg'),
('Watermelon', 'തണ്ണിമത്തൻ', 'fruit', '1 cup', 150, 45, 1, 11, 0.2, 'veg'),
('Mango', 'മാമ്പഴം', 'fruit', '1 cup', 165, 100, 1.4, 25, 0.6, 'veg'),
('Pineapple', 'കൈതച്ചക്ക', 'fruit', '1 cup', 165, 80, 1, 22, 0.2, 'veg'),
('Guava', 'പേരയ്ക്ക', 'fruit', '1 medium', 100, 70, 2.5, 14, 1, 'veg'),
('Grapes', 'മുന്തിരി', 'fruit', '1 cup', 150, 100, 1, 27, 0.2, 'veg'),
('Jackfruit (chakka)', 'ചക്കപ്പഴം', 'fruit', '1 cup', 165, 155, 3, 40, 1, 'veg'),
('Pomegranate', 'മാതളം', 'fruit', '1 cup', 175, 145, 3, 33, 2, 'veg'),
('Dates', 'ഈന്തപ്പഴം', 'fruit', '3 dates', 24, 70, 0.6, 19, 0, 'veg'),
-- Snacks & sweets
('Pazham pori', 'പഴംപൊരി', 'snack', '1 piece', 80, 200, 2, 30, 8, 'veg'),
('Banana chips', 'ഏത്തക്ക ചിപ്സ്', 'snack', '1 handful', 30, 155, 1, 17, 10, 'veg'),
('Unniyappam', 'ഉണ്ണിയപ്പം', 'snack', '1 piece', 30, 70, 1, 10, 3, 'veg'),
('Parippu vada', 'പരിപ്പുവട', 'snack', '1 piece', 40, 120, 5, 12, 6, 'veg'),
('Uzhunnu vada', 'ഉഴുന്നുവട', 'snack', '1 piece', 50, 135, 4, 13, 8, 'veg'),
('Samosa', 'സമൂസ', 'snack', '1 piece', 80, 260, 5, 30, 14, 'veg'),
('Egg puffs', 'മുട്ട പഫ്സ്', 'snack', '1 piece', 100, 300, 8, 28, 17, 'egg'),
('Chicken puffs', 'ചിക്കൻ പഫ്സ്', 'snack', '1 piece', 100, 320, 10, 28, 18, 'nonveg'),
('Sukhiyan', 'സുഖിയൻ', 'snack', '1 piece', 50, 150, 4, 25, 4, 'veg'),
('Achappam', 'അച്ചപ്പം', 'snack', '1 piece', 15, 60, 1, 7, 3, 'veg'),
('Murukku', 'മുറുക്ക്', 'snack', '1 handful', 30, 150, 3, 17, 8, 'veg'),
('Mixture', 'മിക്സ്ചർ', 'snack', '1 handful', 30, 160, 4, 14, 10, 'veg'),
('Marie biscuits', 'മാരി ബിസ്കറ്റ്', 'snack', '2 biscuits', 14, 60, 1, 10, 1.5, 'veg'),
('Instant noodles', 'നൂഡിൽസ്', 'snack', '1 pack', 70, 310, 7, 42, 13, 'veg'),
('French fries', 'ഫ്രഞ്ച് ഫ്രൈസ്', 'snack', '1 medium', 115, 330, 4, 43, 16, 'veg'),
('Pizza', 'പിസ്സ', 'snack', '1 slice', 100, 280, 12, 33, 11, 'veg'),
('Palada payasam', 'പാലട പായസം', 'sweet', '1 cup', 150, 300, 6, 48, 9, 'veg'),
('Semiya payasam', 'സേമിയ പായസം', 'sweet', '1 cup', 150, 250, 6, 40, 8, 'veg'),
('Gulab jamun', 'ഗുലാബ് ജാമുൻ', 'sweet', '1 piece', 40, 150, 2, 25, 5, 'veg'),
('Ice cream', 'ഐസ്ക്രീം', 'sweet', '1 scoop', 65, 140, 2.5, 16, 7, 'veg'),
-- Drinks
('Tea with milk & sugar', 'ചായ', 'drink', '1 cup', 150, 90, 2.5, 13, 3, 'veg'),
('Coffee with milk & sugar', 'കാപ്പി', 'drink', '1 cup', 150, 90, 2.5, 13, 3, 'veg'),
('Black coffee (no sugar)', 'കട്ടൻ കാപ്പി', 'drink', '1 cup', 150, 5, 0.3, 0, 0, 'veg'),
('Black tea with sugar', 'കട്ടൻ ചായ', 'drink', '1 cup', 150, 30, 0, 8, 0, 'veg'),
('Lime juice with sugar', 'നാരങ്ങാവെള്ളം', 'drink', '1 glass', 250, 80, 0, 20, 0, 'veg'),
('Tender coconut water', 'ഇളനീർ', 'drink', '1 coconut', 250, 45, 0.5, 9, 0.5, 'veg'),
('Fruit juice with sugar', 'ജ്യൂസ്', 'drink', '1 glass', 250, 150, 1, 36, 0.3, 'veg'),
('Sweet lassi', 'ലസ്സി', 'drink', '1 glass', 250, 220, 7, 30, 8, 'veg'),
('Soft drink', 'സോഫ്റ്റ് ഡ്രിങ്ക്', 'drink', '1 can', 330, 140, 0, 35, 0, 'veg');
