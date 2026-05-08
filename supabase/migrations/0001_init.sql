-- Ruhi initial schema (PR #30).
--
-- Four tables backing cross-device sync:
--   profiles       — one row per user, JSONB payload (matches localStorage shape)
--   journals       — many rows per user (one per voice journal entry)
--   weekly_plans   — one current plan per user, JSONB payload
--   pantry         — one row per user, free-text string (matches localStorage shape)
--
-- All four use row-level security so each authenticated user can ONLY read,
-- write, and delete their own rows. The anon (publishable) key Ruhi ships
-- in NEXT_PUBLIC_* env vars is safe to expose because RLS is the gate.
--
-- This migration is idempotent: re-running it on a project that already has
-- the tables/policies will succeed (CREATE … IF NOT EXISTS, DROP POLICY IF
-- EXISTS, etc.), so it's safe to paste into the SQL editor multiple times
-- during dev. PR #32 wires journals/weekly_plans/pantry to the app; #30
-- defines the schema so #32 doesn't need its own migration.

-- ── Helper: auto-update updated_at on every row mutation ──────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── profiles ──────────────────────────────────────────────────────
-- One row per user. `data` mirrors the localStorage `ruhi_profile` JSON
-- (diet, carbStrictness, cuisines, avoidances, movements, goals,
-- tracksCycle, lastPeriodStart, cycleLength, age, onboardingComplete, …).
-- Stored as JSONB so the profile shape can evolve without schema migrations.
create table if not exists public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_delete_own" on public.profiles;

-- Plain English: a signed-in user can only read the row whose user_id
-- matches their auth.uid(). Other users' profiles are invisible.
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = user_id);

-- Plain English: when inserting a profile, the user_id MUST be the
-- caller's own auth.uid(). You can't create a profile for someone else.
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = user_id);

-- Plain English: a user can update only their own profile row. The
-- with-check clause prevents them from changing the user_id to someone
-- else's during an update.
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Plain English: a user can delete only their own profile row. (Cascades
-- from auth.users delete already handle account deletion server-side.)
create policy "profiles_delete_own"
  on public.profiles for delete
  using (auth.uid() = user_id);

-- ── journals ──────────────────────────────────────────────────────
-- Many rows per user. `client_id` is the localStorage entry id so the
-- app can upsert the same entry across devices without duplicating it.
-- Indexed by (user_id, timestamp_ms desc) for the typical "show me my
-- last 5 entries for this phase/day" query.
create table if not exists public.journals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  client_id    text not null,
  timestamp_ms bigint not null,
  phase        text,
  cycle_day    int,
  energy       int,
  note         text,
  reflection   text,
  created_at   timestamptz not null default now(),
  unique (user_id, client_id)
);

create index if not exists journals_user_ts
  on public.journals (user_id, timestamp_ms desc);

alter table public.journals enable row level security;

drop policy if exists "journals_select_own" on public.journals;
drop policy if exists "journals_insert_own" on public.journals;
drop policy if exists "journals_update_own" on public.journals;
drop policy if exists "journals_delete_own" on public.journals;

-- Plain English: a user can read only their own journal entries.
create policy "journals_select_own"
  on public.journals for select
  using (auth.uid() = user_id);

-- Plain English: when inserting a journal entry, the user_id MUST be
-- the caller's own auth.uid(). No writing entries on someone's behalf.
create policy "journals_insert_own"
  on public.journals for insert
  with check (auth.uid() = user_id);

-- Plain English: a user can update only their own journal entries
-- (e.g. to attach a reflection that arrived async after the initial save).
create policy "journals_update_own"
  on public.journals for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Plain English: a user can delete only their own journal entries.
create policy "journals_delete_own"
  on public.journals for delete
  using (auth.uid() = user_id);

-- ── weekly_plans ──────────────────────────────────────────────────
-- One current plan per user. JSONB matches the in-memory WeeklyPlan
-- shape from lib/weeklyPlan.js (weekOf, days[], menu[], shoppingList, …).
-- When a user generates a new plan it overwrites the row (upsert).
create table if not exists public.weekly_plans (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

drop trigger if exists weekly_plans_set_updated_at on public.weekly_plans;
create trigger weekly_plans_set_updated_at
  before update on public.weekly_plans
  for each row execute function public.set_updated_at();

alter table public.weekly_plans enable row level security;

drop policy if exists "weekly_plans_select_own" on public.weekly_plans;
drop policy if exists "weekly_plans_insert_own" on public.weekly_plans;
drop policy if exists "weekly_plans_update_own" on public.weekly_plans;
drop policy if exists "weekly_plans_delete_own" on public.weekly_plans;

-- Plain English: a user can read only their own current weekly plan.
create policy "weekly_plans_select_own"
  on public.weekly_plans for select
  using (auth.uid() = user_id);

-- Plain English: when creating a weekly plan, the user_id MUST be the
-- caller's own auth.uid().
create policy "weekly_plans_insert_own"
  on public.weekly_plans for insert
  with check (auth.uid() = user_id);

-- Plain English: a user can update only their own weekly plan row.
create policy "weekly_plans_update_own"
  on public.weekly_plans for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Plain English: a user can delete only their own weekly plan row.
create policy "weekly_plans_delete_own"
  on public.weekly_plans for delete
  using (auth.uid() = user_id);

-- ── pantry ────────────────────────────────────────────────────────
-- One row per user, free-text. Mirrors the localStorage `ruhi_pantry`
-- single-string shape exactly so the existing chip parser (parsePantryChips
-- in lib/storage.js) keeps working unchanged once #32 wires it up.
create table if not exists public.pantry (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  text       text not null default '',
  updated_at timestamptz not null default now()
);

drop trigger if exists pantry_set_updated_at on public.pantry;
create trigger pantry_set_updated_at
  before update on public.pantry
  for each row execute function public.set_updated_at();

alter table public.pantry enable row level security;

drop policy if exists "pantry_select_own" on public.pantry;
drop policy if exists "pantry_insert_own" on public.pantry;
drop policy if exists "pantry_update_own" on public.pantry;
drop policy if exists "pantry_delete_own" on public.pantry;

-- Plain English: a user can read only their own pantry row.
create policy "pantry_select_own"
  on public.pantry for select
  using (auth.uid() = user_id);

-- Plain English: when inserting a pantry row, the user_id MUST be the
-- caller's own auth.uid().
create policy "pantry_insert_own"
  on public.pantry for insert
  with check (auth.uid() = user_id);

-- Plain English: a user can update only their own pantry row.
create policy "pantry_update_own"
  on public.pantry for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Plain English: a user can delete only their own pantry row.
create policy "pantry_delete_own"
  on public.pantry for delete
  using (auth.uid() = user_id);
