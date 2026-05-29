-- Prompt Refina — accounts/DB phase (milestones 2 & 4).
-- Schema + Row-Level Security for per-user cloud sync (personal data only;
-- teams/collaboration come later).
--
-- How to run:
--   • Supabase SQL editor: paste this whole file and run, OR
--   • Supabase CLI: `supabase db push` (with this file under supabase/migrations/).
--
-- If you ran an earlier version of this file, drop the affected tables first
-- (the project has no real data yet): the synced tables now use a client text
-- id + a `data` jsonb payload so every client field round-trips losslessly.
--
-- Anonymous use is unaffected: logged-out visitors never touch these tables
-- (they stay on localStorage). RLS denies the `anon` role; only `authenticated`
-- users can read/write, and only their own rows.

-- ── profiles (extends auth.users; holds plan for future monetization) ──
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  plan        text not null default 'free',
  created_at  timestamptz not null default now()
);

-- ── Synced collections: id is the client-supplied id; `data` holds the full
--    app entry (lossless — changes/scores/pins/tags/folders/versions/etc.). ──
create table if not exists public.refinements (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  data        jsonb not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.saved_prompts (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  data        jsonb not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.conversations (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  data        jsonb not null,
  created_at  timestamptz not null default now()
);

-- ── usage_events (typed for metering / future billing; append-only) ──
create table if not exists public.usage_events (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  model          text,
  input_tokens   integer not null default 0,
  output_tokens  integer not null default 0,
  cost           numeric(12,6),
  kind           text,
  latency_ms     integer,
  created_at     timestamptz not null default now()
);

-- ── settings (one jsonb blob per user) ──
create table if not exists public.settings (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ── Indexes for per-user, recent-first reads ──
create index if not exists refinements_user_created_idx   on public.refinements   (user_id, created_at desc);
create index if not exists saved_prompts_user_created_idx  on public.saved_prompts  (user_id, created_at desc);
create index if not exists conversations_user_created_idx  on public.conversations  (user_id, created_at desc);
create index if not exists usage_events_user_created_idx   on public.usage_events   (user_id, created_at desc);

-- ── Row-Level Security: each user sees only their own rows ──
alter table public.profiles      enable row level security;
alter table public.refinements   enable row level security;
alter table public.saved_prompts enable row level security;
alter table public.conversations enable row level security;
alter table public.usage_events  enable row level security;
alter table public.settings      enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own settings" on public.settings;
create policy "own settings" on public.settings
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own refinements" on public.refinements;
create policy "own refinements" on public.refinements
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own saved_prompts" on public.saved_prompts;
create policy "own saved_prompts" on public.saved_prompts
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own conversations" on public.conversations;
create policy "own conversations" on public.conversations
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- usage_events: read + insert own (append-only metering).
drop policy if exists "read own usage" on public.usage_events;
create policy "read own usage" on public.usage_events
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "insert own usage" on public.usage_events;
create policy "insert own usage" on public.usage_events
  for insert to authenticated with check (auth.uid() = user_id);

-- ── Explicit grants (RLS is the real gate; grants make the file portable) ──
grant select, insert, update, delete
  on public.profiles, public.refinements, public.saved_prompts,
     public.conversations, public.settings
  to authenticated;
grant select, insert on public.usage_events to authenticated;

-- ── Auto-provision a profile + settings row on signup ──
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  insert into public.settings (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Keep settings.updated_at fresh ──
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists settings_set_updated_at on public.settings;
create trigger settings_set_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();
