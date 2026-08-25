-- FluxCast initial schema
--
-- Design notes
--   * Status columns are TEXT + CHECK rather than Postgres ENUM types. Adding a
--     value to an ENUM requires a migration that cannot run inside a
--     transaction on older Postgres; a CHECK constraint is trivially editable
--     and just as safe for a prototype.
--   * `events` references our own team plus a free-text opponent. FluxCast only
--     hosts one school today and opponents do not have accounts, so a second
--     team foreign key would be dead weight. `is_home` records who hosted.
--   * `broadcasts` intentionally has NO stream_key column. LiveKit will return
--     the stream key for an ingress ID on demand, so FluxCast stores only the
--     ingress ID and fetches credentials server-side when an admin views them.
--     See README, "Why we don't store stream keys".

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- schools
-- ---------------------------------------------------------------------------
create table if not exists public.schools (
  id              uuid primary key default gen_random_uuid(),
  name            text        not null,
  slug            text        not null unique,
  short_name      text        not null,
  mascot          text,
  city            text,
  state           text,
  logo_url        text,
  primary_color   text,
  secondary_color text,
  active          boolean     not null default true,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- sports
-- ---------------------------------------------------------------------------
create table if not exists public.sports (
  id   uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique
);

-- ---------------------------------------------------------------------------
-- teams  (a school's squad in one sport, e.g. Homewood Varsity Football)
-- ---------------------------------------------------------------------------
create table if not exists public.teams (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid        not null references public.schools (id) on delete cascade,
  sport_id   uuid        not null references public.sports (id)  on delete restrict,
  level      text        not null default 'Varsity',
  gender     text,
  created_at timestamptz not null default now(),
  unique (school_id, sport_id, level, gender)
);

create index if not exists teams_school_id_idx on public.teams (school_id);

-- ---------------------------------------------------------------------------
-- events  (a single game)
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id            uuid primary key default gen_random_uuid(),
  sport_id      uuid        not null references public.sports (id) on delete restrict,
  team_id       uuid        not null references public.teams (id)  on delete cascade,
  opponent_name text        not null,
  is_home       boolean     not null default true,
  start_time    timestamptz not null,
  location      text,
  status        text        not null default 'scheduled'
                  check (status in ('scheduled', 'live', 'final', 'cancelled')),
  created_at    timestamptz not null default now()
);

create index if not exists events_start_time_idx on public.events (start_time);
create index if not exists events_team_id_idx    on public.events (team_id);

-- ---------------------------------------------------------------------------
-- broadcasts  (the audio feed attached to an event)
-- ---------------------------------------------------------------------------
create table if not exists public.broadcasts (
  id                 uuid primary key default gen_random_uuid(),
  event_id           uuid        not null references public.events (id) on delete cascade,
  title              text        not null,
  slug               text        not null unique,
  status             text        not null default 'draft'
                       check (status in ('draft', 'ready', 'connected', 'live', 'ended', 'error')),
  livekit_room_name  text unique,
  livekit_ingress_id text,
  -- Non-secret RTMP(S) ingest endpoint. The matching stream key is never stored.
  stream_url         text,
  scheduled_start    timestamptz not null,
  started_at         timestamptz,
  ended_at           timestamptz,
  created_at         timestamptz not null default now()
);

create index if not exists broadcasts_status_idx          on public.broadcasts (status);
create index if not exists broadcasts_scheduled_start_idx on public.broadcasts (scheduled_start);
create index if not exists broadcasts_event_id_idx        on public.broadcasts (event_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Fans browse without an account, so every table is world-readable. Nothing is
-- writable with the publishable (anon) key: all writes go through the service
-- role key, which only ever exists on the server.
-- ---------------------------------------------------------------------------
alter table public.schools    enable row level security;
alter table public.sports     enable row level security;
alter table public.teams      enable row level security;
alter table public.events     enable row level security;
alter table public.broadcasts enable row level security;

drop policy if exists "public read schools"    on public.schools;
drop policy if exists "public read sports"     on public.sports;
drop policy if exists "public read teams"      on public.teams;
drop policy if exists "public read events"     on public.events;
drop policy if exists "public read broadcasts" on public.broadcasts;

create policy "public read schools"    on public.schools    for select using (true);
create policy "public read sports"     on public.sports     for select using (true);
create policy "public read teams"      on public.teams      for select using (true);
create policy "public read events"     on public.events     for select using (true);
create policy "public read broadcasts" on public.broadcasts for select using (true);
