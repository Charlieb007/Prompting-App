-- Prompt Refina — accounts/DB phase, milestone 2.
-- Schema + Row-Level Security for per-user cloud sync (personal data only;
-- teams/collaboration come in a later phase).
--
-- How to run:
--   • Supabase SQL editor: paste this whole file and run, OR
--   • Supabase CLI: `supabase db push` (with this file under supabase/migrations/).
--
-- Anonymous use is unaffected: logged-out visitors never touch these tables
-- (they stay on localStorage). RLS denies the `anon` role by default since no
-- anon policies are defined; only `authenticated` users can read/write, and
-- only their own rows.

-- ── profiles (extends auth.users; holds plan for future monetization) ──
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  plan        text not null default 'free',
  created_at  timestamptz not null default now()
);

-- ── refinements (history) ──
create table if not exists public.refinements (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  rough         text not null,
  improved      text not null,
  changes       jsonb not null default '[]'::jsonb,
  scores        jsonb,
  category      text default 'general',
  model         text,
  usage         jsonb,
  latency_ms    integer,
  is_follow_up  boolean not null default false,
  feedback      text,
  created_at    timestamptz not null default now()
);

-- ── saved_prompts ──
create table if not exists public.saved_prompts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  rough       text not null,
  improved    text not null,
  name        text default '',
  folder      text,
  category    text default 'general',
  model       text,
  changes     jsonb not null default '[]'::jsonb,
  scores      jsonb,
  created_at  timestamptz not null default now()
);

-- ── conversations (multi-turn run drawer) ──
create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text default '',
  messages    jsonb not null default '[]'::jsonb,
  model       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── usage_events (cost/latency metering; basis for future billing) ──
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

-- ── Indexes for the common per-user, recent-first queries ──
create index if not exists refinements_user_created_idx   on public.refinements   (user_id, created_at desc);
create index if not exists saved_prompts_user_created_idx  on public.saved_prompts  (user_id, created_at desc);
create index if not exists conversations_user_updated_idx  on public.conversations  (user_id, updated_at desc);
create index if not exists usage_events_user_created_idx   on public.usage_events   (user_id, created_at desc);

-- ── Row-Level Security: each user sees only their own rows ──
alter table public.profiles      enable row level security;
alter table public.refinements   enable row level security;
alter table public.saved_prompts enable row level security;
alter table public.conversations enable row level security;
alter table public.usage_events  enable row level security;
alter table public.settings      enable row level security;

-- profiles & settings are keyed by the user id directly.
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own settings" on public.settings;
create policy "own settings" on public.settings
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- data tables are keyed by user_id.
drop policy if exists "own refinements" on public.refinements;
create policy "own refinements" on public.refinements
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own saved_prompts" on public.saved_prompts;
create policy "own saved_prompts" on public.saved_prompts
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own conversations" on public.conversations;
create policy "own conversations" on public.conversations
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- usage_events: users may read and insert their own; updates/deletes are not
-- exposed (metering rows are append-only from the client's perspective).
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

-- ── Keep updated_at fresh ──
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

drop trigger if exists settings_set_updated_at on public.settings;
create trigger settings_set_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();
