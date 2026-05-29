-- Prompt Refina — billing phase (Stripe Free + Pro).
-- Adds subscription fields to profiles and an admin-editable config table for
-- the daily refinement limits, so they can be changed in the Supabase Table
-- Editor with no code change or redeploy.
--
-- Run in the Supabase SQL editor (or `supabase db push`). Idempotent.

-- ── profiles: subscription state (synced from Stripe webhooks) ──
alter table public.profiles add column if not exists stripe_customer_id   text;
alter table public.profiles add column if not exists subscription_status  text;     -- active | canceled | past_due | null
alter table public.profiles add column if not exists price_id             text;
alter table public.profiles add column if not exists current_period_end   timestamptz;
-- (public.profiles.plan already exists: 'free' | 'pro')

-- ── app_config: admin-editable runtime config (key → jsonb) ──
create table if not exists public.app_config (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table public.app_config enable row level security;

-- Public read (limits are non-sensitive and the client needs them). There is
-- intentionally NO write policy: only the Supabase dashboard / service role can
-- change config — that's the admin edit path.
drop policy if exists "read app_config" on public.app_config;
create policy "read app_config" on public.app_config
  for select to anon, authenticated using (true);

grant select on public.app_config to anon, authenticated;

-- Seed the daily refinement limits. Admins change these by editing this row's
-- `value` in the Table Editor — no deploy needed. null = unlimited.
insert into public.app_config (key, value)
values ('limits', '{"anonymousDailyRefinements": 10, "freeDailyRefinements": 20}'::jsonb)
on conflict (key) do nothing;
