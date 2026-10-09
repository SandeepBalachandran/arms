-- Private notes the gym team keeps about a member (injuries, preferences…).
-- Members never see them.
create table public.member_notes (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  member_id uuid not null references public.gym_members (id) on delete cascade,
  body text not null check (length(body) between 1 and 1000),
  author_id uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index member_notes_member_idx on public.member_notes (member_id, created_at desc);

alter table public.member_notes enable row level security;

create policy "member_notes_select" on public.member_notes for select
  using (public.is_gym_team(gym_id));
create policy "member_notes_insert" on public.member_notes for insert
  with check (
    public.is_gym_team(gym_id)
    and author_id = auth.uid()
    and exists (select 1 from public.gym_members where id = member_id and gym_id = member_notes.gym_id)
  );
-- Authors remove their own notes; staff can remove any.
create policy "member_notes_delete" on public.member_notes for delete
  using (author_id = auth.uid() or public.is_gym_staff(gym_id));
