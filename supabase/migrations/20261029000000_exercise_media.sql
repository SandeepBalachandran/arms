-- How-to guides for exercises: up to three equipment photos, a video link
-- (YouTube, Instagram, Drive...) and instructions in English and Malayalam.
-- One row per gym per exercise, so a gym can add its own guide to built-in
-- exercises too. Photos are public URLs in the "exercise-media" bucket
-- (created by the admin on first upload, like gym logos): equipment photos
-- aren't personal data.

create table public.exercise_media (
  gym_id uuid not null references public.gyms (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  photo_urls text[] not null default '{}' check (cardinality(photo_urls) <= 3),
  video_url text check (video_url ~ '^https://' and length(video_url) <= 500),
  how_to_en text check (length(how_to_en) <= 1000),
  how_to_ml text check (length(how_to_ml) <= 1000),
  updated_by uuid references public.gym_members (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (gym_id, exercise_id)
);

alter table public.exercise_media enable row level security;

-- Everyone in the gym reads the guides; the team writes them, only for
-- exercises this gym can use (built-in or its own).
create policy "exercise_media_select" on public.exercise_media for select
  using (public.my_member_id(gym_id) is not null);
create policy "exercise_media_write" on public.exercise_media for all
  using (public.is_gym_team(gym_id))
  with check (
    public.is_gym_team(gym_id)
    and exists (
      select 1 from public.exercises e
      where e.id = exercise_id and (e.gym_id is null or e.gym_id = exercise_media.gym_id)
    )
  );

-- Which language a member reads guides in. Falls back to English when a
-- guide has no Malayalam text.
alter table public.profiles
  add column language text not null default 'en' check (language in ('en', 'ml'));
grant update (language) on public.profiles to authenticated;
