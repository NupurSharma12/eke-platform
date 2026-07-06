-- Adventure Learning Quest schema
-- Parent accounts (auth.users) + child profiles + learning data

create table public.child_profiles (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  avatar text not null default 'fox',
  color text not null default 'primary',
  created_at timestamptz not null default now()
);

create table public.progress (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  xp integer not null default 0,
  level integer not null default 1,
  coins integer not null default 0,
  streak integer not null default 0,
  last_active_date date,
  daily_goal_xp integer not null default 100,
  daily_xp_earned integer not null default 0,
  pet_stage integer not null default 0,
  pet_name text not null default 'Buddy',
  math_skill_level real not null default 3.0,
  unique(child_id)
);

create table public.quiz_results (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  subject text not null,
  topic text not null,
  score integer not null,
  total integer not null,
  xp_earned integer not null default 0,
  coins_earned integer not null default 0,
  difficulty integer not null default 3,
  created_at timestamptz not null default now()
);

create table public.badges (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  badge_key text not null,
  earned_at timestamptz not null default now(),
  unique(child_id, badge_key)
);

create table public.daily_challenges (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  challenge_date date not null default current_date,
  math_completed boolean not null default false,
  science_completed boolean not null default false,
  history_completed boolean not null default false,
  quiz_completed boolean not null default false,
  unique(child_id, challenge_date)
);

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  activity_type text not null,
  subject text,
  duration_seconds integer not null default 0,
  created_at timestamptz not null default now()
);

create index on public.quiz_results (child_id, created_at desc);
create index on public.activity_log (child_id, created_at desc);

-- RLS
alter table public.child_profiles enable row level security;
alter table public.progress enable row level security;
alter table public.quiz_results enable row level security;
alter table public.badges enable row level security;
alter table public.daily_challenges enable row level security;
alter table public.activity_log enable row level security;

-- child_profiles: parent owns
create policy "select_own_profiles" on public.child_profiles for select to authenticated using (auth.uid() = parent_id);
create policy "insert_own_profiles" on public.child_profiles for insert to authenticated with check (auth.uid() = parent_id);
create policy "update_own_profiles" on public.child_profiles for update to authenticated using (auth.uid() = parent_id) with check (auth.uid() = parent_id);
create policy "delete_own_profiles" on public.child_profiles for delete to authenticated using (auth.uid() = parent_id);

-- progress: parent owns via child
create policy "select_own_progress" on public.progress for select to authenticated using (exists (select 1 from public.child_profiles cp where cp.id = progress.child_id and cp.parent_id = auth.uid()));
create policy "insert_own_progress" on public.progress for insert to authenticated with check (exists (select 1 from public.child_profiles cp where cp.id = progress.child_id and cp.parent_id = auth.uid()));
create policy "update_own_progress" on public.progress for update to authenticated using (exists (select 1 from public.child_profiles cp where cp.id = progress.child_id and cp.parent_id = auth.uid())) with check (exists (select 1 from public.child_profiles cp where cp.id = progress.child_id and cp.parent_id = auth.uid()));
create policy "delete_own_progress" on public.progress for delete to authenticated using (exists (select 1 from public.child_profiles cp where cp.id = progress.child_id and cp.parent_id = auth.uid()));

-- quiz_results
create policy "select_own_quiz" on public.quiz_results for select to authenticated using (exists (select 1 from public.child_profiles cp where cp.id = quiz_results.child_id and cp.parent_id = auth.uid()));
create policy "insert_own_quiz" on public.quiz_results for insert to authenticated with check (exists (select 1 from public.child_profiles cp where cp.id = quiz_results.child_id and cp.parent_id = auth.uid()));
create policy "delete_own_quiz" on public.quiz_results for delete to authenticated using (exists (select 1 from public.child_profiles cp where cp.id = quiz_results.child_id and cp.parent_id = auth.uid()));

-- badges
create policy "select_own_badges" on public.badges for select to authenticated using (exists (select 1 from public.child_profiles cp where cp.id = badges.child_id and cp.parent_id = auth.uid()));
create policy "insert_own_badges" on public.badges for insert to authenticated with check (exists (select 1 from public.child_profiles cp where cp.id = badges.child_id and cp.parent_id = auth.uid()));
create policy "delete_own_badges" on public.badges for delete to authenticated using (exists (select 1 from public.child_profiles cp where cp.id = badges.child_id and cp.parent_id = auth.uid()));

-- daily_challenges
create policy "select_own_daily" on public.daily_challenges for select to authenticated using (exists (select 1 from public.child_profiles cp where cp.id = daily_challenges.child_id and cp.parent_id = auth.uid()));
create policy "insert_own_daily" on public.daily_challenges for insert to authenticated with check (exists (select 1 from public.child_profiles cp where cp.id = daily_challenges.child_id and cp.parent_id = auth.uid()));
create policy "update_own_daily" on public.daily_challenges for update to authenticated using (exists (select 1 from public.child_profiles cp where cp.id = daily_challenges.child_id and cp.parent_id = auth.uid())) with check (exists (select 1 from public.child_profiles cp where cp.id = daily_challenges.child_id and cp.parent_id = auth.uid()));
create policy "delete_own_daily" on public.daily_challenges for delete to authenticated using (exists (select 1 from public.child_profiles cp where cp.id = daily_challenges.child_id and cp.parent_id = auth.uid()));

-- activity_log
create policy "select_own_activity" on public.activity_log for select to authenticated using (exists (select 1 from public.child_profiles cp where cp.id = activity_log.child_id and cp.parent_id = auth.uid()));
create policy "insert_own_activity" on public.activity_log for insert to authenticated with check (exists (select 1 from public.child_profiles cp where cp.id = activity_log.child_id and cp.parent_id = auth.uid()));
create policy "delete_own_activity" on public.activity_log for delete to authenticated using (exists (select 1 from public.child_profiles cp where cp.id = activity_log.child_id and cp.parent_id = auth.uid()));
