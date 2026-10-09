-- Optional workouts & progress. Off by default; a gym turns it on in Settings.
-- Trainers build plans from an exercise library and assign them to members.
-- Members log workouts (from a plan day or free-form) and body measurements.
-- Members write their own logs directly (RLS); the team can read them.

create type public.exercise_measure as enum ('weight_reps', 'reps', 'time');

alter table public.gyms add column workouts_enabled boolean not null default false;

-- Exercise library: global rows (gym_id null) plus each gym's own.
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms (id) on delete cascade,
  name text not null check (length(name) between 2 and 60),
  muscle_group text not null,
  measure public.exercise_measure not null default 'weight_reps',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index exercises_gym_idx on public.exercises (gym_id);

create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  name text not null check (length(name) between 2 and 60),
  description text check (length(description) <= 500),
  created_by uuid references public.gym_members (id) on delete set null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index workout_plans_gym_idx on public.workout_plans (gym_id);

-- Plan items grouped into days by label ("Day A – Push").
create table public.workout_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.workout_plans (id) on delete cascade,
  day_label text not null check (length(day_label) between 1 and 40),
  position integer not null default 0,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  sets integer not null check (sets between 1 and 20),
  reps text not null check (length(reps) between 1 and 20),
  rest_sec integer check (rest_sec between 0 and 900),
  notes text check (length(notes) <= 200)
);

create index workout_plan_items_plan_idx on public.workout_plan_items (plan_id, day_label, position);

create table public.plan_assignments (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  plan_id uuid not null references public.workout_plans (id) on delete cascade,
  member_id uuid not null references public.gym_members (id) on delete cascade,
  assigned_by uuid references public.gym_members (id) on delete set null,
  assigned_at timestamptz not null default now(),
  unique (plan_id, member_id)
);

create index plan_assignments_member_idx on public.plan_assignments (member_id);

create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  member_id uuid not null references public.gym_members (id) on delete cascade,
  plan_id uuid references public.workout_plans (id) on delete set null,
  day_label text,
  performed_at timestamptz not null default now(),
  duration_min integer check (duration_min between 0 and 600),
  notes text check (length(notes) <= 500)
);

create index workout_logs_member_idx on public.workout_logs (member_id, performed_at desc);

create table public.workout_log_sets (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references public.workout_logs (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  set_no integer not null check (set_no between 1 and 50),
  reps integer check (reps between 0 and 1000),
  weight_kg numeric(6, 2) check (weight_kg between 0 and 1000),
  duration_sec integer check (duration_sec between 0 and 36000)
);

create index workout_log_sets_log_idx on public.workout_log_sets (log_id);
create index workout_log_sets_exercise_idx on public.workout_log_sets (exercise_id);

create table public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  member_id uuid not null references public.gym_members (id) on delete cascade,
  measured_on date not null,
  weight_kg numeric(5, 2) check (weight_kg between 20 and 400),
  body_fat_pct numeric(4, 1) check (body_fat_pct between 2 and 70),
  waist_cm numeric(5, 1) check (waist_cm between 30 and 250),
  notes text check (length(notes) <= 300),
  created_at timestamptz not null default now(),
  unique (member_id, measured_on)
);

-- RLS ---------------------------------------------------------------------------------

alter table public.exercises enable row level security;
alter table public.workout_plans enable row level security;
alter table public.workout_plan_items enable row level security;
alter table public.plan_assignments enable row level security;
alter table public.workout_logs enable row level security;
alter table public.workout_log_sets enable row level security;
alter table public.body_metrics enable row level security;

-- True when the caller is assigned the plan.
create function public.is_assigned_plan(p_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.plan_assignments pa
    join public.gym_members gm on gm.id = pa.member_id
    where pa.plan_id = p_plan_id and gm.user_id = auth.uid()
  )
$$;

-- True when the workout log belongs to the caller.
create function public.is_my_log(p_log_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workout_logs l
    where l.id = p_log_id and public.is_my_membership(l.member_id)
  )
$$;

create function public.log_gym_id(p_log_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select gym_id from public.workout_logs where id = p_log_id
$$;

create function public.plan_gym_id(p_plan_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select gym_id from public.workout_plans where id = p_plan_id
$$;

create policy "exercises_select" on public.exercises for select
  using (gym_id is null or public.auth_role_in(gym_id) is not null);
create policy "exercises_insert" on public.exercises for insert
  with check (gym_id is not null and public.is_gym_team(gym_id));
create policy "exercises_update" on public.exercises for update
  using (gym_id is not null and public.is_gym_team(gym_id))
  with check (gym_id is not null and public.is_gym_team(gym_id));

create policy "workout_plans_select" on public.workout_plans for select
  using (public.is_gym_team(gym_id) or public.is_assigned_plan(id));
create policy "workout_plans_insert" on public.workout_plans for insert
  with check (public.is_gym_team(gym_id));
create policy "workout_plans_update" on public.workout_plans for update
  using (public.is_gym_team(gym_id)) with check (public.is_gym_team(gym_id));

create policy "workout_plan_items_select" on public.workout_plan_items for select
  using (public.is_gym_team(public.plan_gym_id(plan_id)) or public.is_assigned_plan(plan_id));
create policy "workout_plan_items_write" on public.workout_plan_items for all
  using (public.is_gym_team(public.plan_gym_id(plan_id)))
  with check (public.is_gym_team(public.plan_gym_id(plan_id)));

create policy "plan_assignments_select" on public.plan_assignments for select
  using (public.is_my_membership(member_id) or public.is_gym_team(gym_id));
create policy "plan_assignments_write" on public.plan_assignments for all
  using (public.is_gym_team(gym_id))
  with check (
    public.is_gym_team(gym_id)
    and public.plan_gym_id(plan_id) = gym_id
    and exists (select 1 from public.gym_members where id = member_id and gym_id = plan_assignments.gym_id)
  );

-- Logs: members own theirs; the team can read.
create policy "workout_logs_select" on public.workout_logs for select
  using (public.is_my_membership(member_id) or public.is_gym_team(gym_id));
create policy "workout_logs_insert" on public.workout_logs for insert
  with check (
    public.is_my_membership(member_id)
    and exists (select 1 from public.gym_members where id = member_id and gym_id = workout_logs.gym_id)
  );
create policy "workout_logs_update" on public.workout_logs for update
  using (public.is_my_membership(member_id)) with check (public.is_my_membership(member_id));
create policy "workout_logs_delete" on public.workout_logs for delete
  using (public.is_my_membership(member_id));

create policy "workout_log_sets_select" on public.workout_log_sets for select
  using (public.is_my_log(log_id) or public.is_gym_team(public.log_gym_id(log_id)));
create policy "workout_log_sets_write" on public.workout_log_sets for all
  using (public.is_my_log(log_id)) with check (public.is_my_log(log_id));

create policy "body_metrics_select" on public.body_metrics for select
  using (public.is_my_membership(member_id) or public.is_gym_team(gym_id));
create policy "body_metrics_write" on public.body_metrics for all
  using (public.is_my_membership(member_id))
  with check (
    public.is_my_membership(member_id)
    and exists (select 1 from public.gym_members where id = member_id and gym_id = body_metrics.gym_id)
  );

-- Starter exercise library ------------------------------------------------------------

insert into public.exercises (name, muscle_group, measure) values
  ('Bench Press', 'Chest', 'weight_reps'),
  ('Incline Dumbbell Press', 'Chest', 'weight_reps'),
  ('Chest Fly (Machine)', 'Chest', 'weight_reps'),
  ('Push-up', 'Chest', 'reps'),
  ('Dips', 'Chest', 'reps'),
  ('Overhead Press', 'Shoulders', 'weight_reps'),
  ('Dumbbell Shoulder Press', 'Shoulders', 'weight_reps'),
  ('Lateral Raise', 'Shoulders', 'weight_reps'),
  ('Rear Delt Fly', 'Shoulders', 'weight_reps'),
  ('Face Pull', 'Shoulders', 'weight_reps'),
  ('Shrug', 'Back', 'weight_reps'),
  ('Pull-up', 'Back', 'reps'),
  ('Lat Pulldown', 'Back', 'weight_reps'),
  ('Seated Cable Row', 'Back', 'weight_reps'),
  ('Barbell Row', 'Back', 'weight_reps'),
  ('One-arm Dumbbell Row', 'Back', 'weight_reps'),
  ('Deadlift', 'Back', 'weight_reps'),
  ('Back Squat', 'Legs', 'weight_reps'),
  ('Front Squat', 'Legs', 'weight_reps'),
  ('Goblet Squat', 'Legs', 'weight_reps'),
  ('Leg Press', 'Legs', 'weight_reps'),
  ('Romanian Deadlift', 'Legs', 'weight_reps'),
  ('Walking Lunge', 'Legs', 'weight_reps'),
  ('Bulgarian Split Squat', 'Legs', 'weight_reps'),
  ('Leg Extension', 'Legs', 'weight_reps'),
  ('Leg Curl', 'Legs', 'weight_reps'),
  ('Hip Thrust', 'Glutes', 'weight_reps'),
  ('Calf Raise', 'Legs', 'weight_reps'),
  ('Biceps Curl', 'Arms', 'weight_reps'),
  ('Hammer Curl', 'Arms', 'weight_reps'),
  ('Triceps Pushdown', 'Arms', 'weight_reps'),
  ('Skull Crusher', 'Arms', 'weight_reps'),
  ('Plank', 'Core', 'time'),
  ('Crunch', 'Core', 'reps'),
  ('Hanging Leg Raise', 'Core', 'reps'),
  ('Kettlebell Swing', 'Full body', 'weight_reps'),
  ('Burpee', 'Full body', 'reps'),
  ('Treadmill', 'Cardio', 'time'),
  ('Stationary Bike', 'Cardio', 'time'),
  ('Rowing Machine', 'Cardio', 'time'),
  ('Elliptical', 'Cardio', 'time');
