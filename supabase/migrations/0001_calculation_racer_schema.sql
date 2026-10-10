-- =============================================================================
-- CALCULATION RACER — Complete PostgreSQL Schema, RLS Policies & RPC Functions
-- Run in Supabase SQL Editor or via `supabase db push`
-- =============================================================================

create extension if not exists pgcrypto;

-- 1. PROFILES TABLE
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null unique
    check (char_length(nickname) between 2 and 20),
  car_color text not null default 'blue'
    check (car_color in ('blue', 'red', 'green', 'purple')),
  wins integer not null default 0 check (wins >= 0),
  total_races integer not null default 0 check (total_races >= 0),
  best_time_ms integer not null default 0 check (best_time_ms >= 0),
  best_score integer not null default 0 check (best_score >= 0),
  total_correct integer not null default 0 check (total_correct >= 0),
  total_wrong integer not null default 0 check (total_wrong >= 0),
  is_public_profile boolean not null default true,
  is_admin boolean not null default false,
  is_banned boolean not null default false,
  ban_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. QUESTIONS TABLE
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  category text not null check (
    category in ('math', 'gk', 'science', 'current_affairs')
  ),
  subcategory text not null default '',
  difficulty text not null check (
    difficulty in ('easy', 'medium', 'hard')
  ),
  question_text text not null check (char_length(question_text) between 1 and 500),
  options jsonb not null
    check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
  correct_option integer not null
    check (correct_option between 0 and 3),
  explanation text not null default '',
  source_url text not null default '',
  published_at date,
  verified_at timestamptz,
  expires_at date,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Public view that strips correct_option and excludes expired current_affairs questions
create or replace view public.public_questions as
  select
    id,
    category,
    subcategory,
    difficulty,
    question_text,
    options,
    source_url,
    published_at,
    verified_at,
    expires_at,
    is_active,
    created_at
  from public.questions
  where is_active = true
    and (expires_at is null or expires_at >= current_date);

-- 3. ROOMS TABLE
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique
    check (room_code ~ '^[A-Z0-9]{6}$'),
  host_id uuid not null references public.profiles(id) on delete cascade,
  max_players integer not null
    check (max_players in (2, 4)),
  category text not null check (
    category in ('math', 'gk', 'science', 'current_affairs')
  ),
  subcategories jsonb not null default '[]'::jsonb,
  difficulty text not null check (
    difficulty in ('easy', 'medium', 'hard')
  ),
  question_count integer not null default 10
    check (question_count in (10, 15, 20)),
  question_time_limit_sec integer not null default 20
    check (question_time_limit_sec in (10, 15, 20, 30)),
  status text not null default 'waiting'
    check (status in ('waiting', 'countdown', 'racing', 'finished', 'abandoned')),
  countdown_started_at timestamptz,
  race_started_at timestamptz,
  race_finished_at timestamptz,
  winner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. ROOM PLAYERS TABLE
create table if not exists public.room_players (
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  car_color text not null default 'blue'
    check (car_color in ('blue', 'red', 'green', 'purple')),
  ready boolean not null default false,
  distance numeric not null default 0 check (distance between 0 and 100),
  score integer not null default 0 check (score between 0 and 200),
  correct_answers integer not null default 0 check (correct_answers between 0 and 20),
  wrong_answers integer not null default 0 check (wrong_answers between 0 and 20),
  current_question_index integer not null default 0 check (current_question_index between 0 and 20),
  finished boolean not null default false,
  finish_time_ms integer not null default 0 check (finish_time_ms >= 0),
  placement integer check (placement between 1 and 4),
  connected boolean not null default true,
  last_seen_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (room_id, player_id)
);

-- 5. RACE QUESTIONS TABLE (Ordered 10/15/20-question sequence per room)
create table if not exists public.race_questions (
  room_id uuid not null references public.rooms(id) on delete cascade,
  question_index integer not null check (question_index between 0 and 19),
  question_id uuid not null references public.questions(id) on delete restrict,
  primary key (room_id, question_index)
);

-- 6. ANSWER SUBMISSIONS TABLE (Enforces exactly 1 submission per player per question)
create table if not exists public.answer_submissions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  question_index integer not null check (question_index between 0 and 19),
  selected_option integer not null check (selected_option between -1 and 3),
  is_correct boolean not null,
  distance_delta numeric not null check (distance_delta between -10 and 15),
  time_taken_ms integer not null check (time_taken_ms >= 0),
  submitted_at timestamptz not null default now(),
  unique (room_id, player_id, question_index)
);

-- 7. RACE RESULTS TABLE (Saved once per room and player)
create table if not exists public.race_results (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete set null,
  player_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null default '2p' check (mode in ('solo', '2p', '4p', 'timed')),
  category text not null check (category in ('math', 'gk', 'science', 'current_affairs')),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  placement integer not null check (placement between 1 and 4),
  score integer not null default 0 check (score between 0 and 200),
  correct_answers integer not null default 0 check (correct_answers between 0 and 20),
  wrong_answers integer not null default 0 check (wrong_answers between 0 and 20),
  accuracy numeric(5,2) not null default 0 check (accuracy between 0 and 100),
  distance numeric not null default 0 check (distance between 0 and 100),
  duration_ms integer not null check (duration_ms >= 0),
  completed_at timestamptz not null default now(),
  unique (room_id, player_id)
);

-- 8. QUESTION REPORTS TABLE
create table if not exists public.question_reports (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 500),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 9. ADMIN AUDIT LOGS TABLE
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete restrict,
  action text not null,
  target_type text not null check (target_type in ('question', 'player', 'room', 'leaderboard', 'report', 'system')),
  target_id text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- INDEXES
create index if not exists questions_active_lookup
  on public.questions(category, subcategory, difficulty)
  where is_active = true;

create index if not exists rooms_code_lookup
  on public.rooms(room_code);

create index if not exists race_results_player_history
  on public.race_results(player_id, completed_at desc);

create index if not exists race_results_leaderboard
  on public.race_results(placement, score desc, duration_ms asc, completed_at desc);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.questions enable row level security;
alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.race_questions enable row level security;
alter table public.answer_submissions enable row level security;
alter table public.race_results enable row level security;
alter table public.question_reports enable row level security;
alter table public.admin_audit_logs enable row level security;

create or replace function public.is_admin_user()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true and is_banned = false
  );
$$;

create policy "Public profiles are viewable when agreed"
  on public.profiles for select
  using (is_public_profile = true or id = auth.uid() or public.is_admin_user());

create policy "Users can create their own profile"
  on public.profiles for insert
  with check (id = auth.uid() and is_admin = false and is_banned = false);

create policy "Users can update their own nickname and car color only"
  on public.profiles for update
  using (id = auth.uid() or public.is_admin_user())
  with check (
    public.is_admin_user() or (
      id = auth.uid() and is_admin = false and is_banned = false
    )
  );

create policy "Admins have full access to questions"
  on public.questions for all
  using (public.is_admin_user())
  with check (public.is_admin_user());

create policy "Authenticated users can view rooms"
  on public.rooms for select
  using (auth.uid() is not null);

create policy "Authenticated non-banned users can create rooms"
  on public.rooms for insert
  with check (host_id = auth.uid());

create policy "Authenticated users can view room players"
  on public.room_players for select
  using (auth.uid() is not null);

create policy "Room participants can view assigned race question IDs"
  on public.race_questions for select
  using (
    exists (
      select 1 from public.room_players rp
      where rp.room_id = race_questions.room_id and rp.player_id = auth.uid()
    )
  );

create policy "Players can view their own or room submissions"
  on public.answer_submissions for select
  using (player_id = auth.uid() or public.is_admin_user());

create policy "Public leaderboard and own race results are viewable"
  on public.race_results for select
  using (true);

create policy "Authenticated users can submit question reports"
  on public.question_reports for insert
  with check (reporter_id = auth.uid());

create policy "Admins and reporters can view reports"
  on public.question_reports for select
  using (reporter_id = auth.uid() or public.is_admin_user());

create policy "Admins can update question reports"
  on public.question_reports for update
  using (public.is_admin_user());

create policy "Admins can view and insert audit logs"
  on public.admin_audit_logs for all
  using (public.is_admin_user())
  with check (public.is_admin_user() and admin_id = auth.uid());

-- 10. PLAYER QUESTION HISTORY TABLE (Prevents repeated questions across games)
create table if not exists public.question_history (
  player_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  category text not null check (category in ('math', 'gk', 'science', 'current_affairs')),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  times_shown integer not null default 1 check (times_shown >= 1),
  last_shown_at timestamptz not null default now(),
  primary key (player_id, question_id)
);

create index if not exists question_history_player_lookup
  on public.question_history(player_id, category, difficulty);

alter table public.question_history enable row level security;

create policy "Players can view and update their own question history"
  on public.question_history for all
  using (player_id = auth.uid() or public.is_admin_user())
  with check (player_id = auth.uid() or public.is_admin_user());

-- 11. ONE-TIME OWNER ADMIN BOOTSTRAP LOCK
create table if not exists public.admin_bootstrap_lock (
  id text primary key default 'admin_bootstrap' check (id = 'admin_bootstrap'),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  bootstrapped boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.admin_bootstrap_lock enable row level security;

create policy "Admins can view bootstrap lock"
  on public.admin_bootstrap_lock for select
  using (public.is_admin_user() or owner_id = auth.uid());

