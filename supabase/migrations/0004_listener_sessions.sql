-- Who listened, and for how long.
--
-- One row per listening device per broadcast. The browser generates an opaque
-- random key, keeps it in localStorage for that broadcast, and sends it when
-- asking for a token and on each status poll. Reconnects and page reloads reuse
-- the key, so a listener who drops and returns stays one row rather than
-- inflating the count.
--
-- Deliberately NOT collected: IP address, user agent, location, anything
-- identifying. Fans do not have accounts and are not asked to. The key is a
-- random string that means nothing outside this table, and it counts devices,
-- not people.

create table if not exists public.listener_sessions (
  id           uuid primary key default gen_random_uuid(),
  broadcast_id uuid        not null references public.broadcasts (id) on delete cascade,
  -- Opaque per-device, per-broadcast identifier generated in the browser.
  listener_key text        not null,
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now(),
  unique (broadcast_id, listener_key)
);

create index if not exists listener_sessions_broadcast_idx
  on public.listener_sessions (broadcast_id);
create index if not exists listener_sessions_last_seen_idx
  on public.listener_sessions (broadcast_id, last_seen);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Unlike the schedule, this is operational data and is not world-readable.
-- Writes go through the service role; admins may read their own school's.
-- ---------------------------------------------------------------------------
alter table public.listener_sessions enable row level security;

drop policy if exists "admins read listener sessions" on public.listener_sessions;
create policy "admins read listener sessions" on public.listener_sessions
  for select to authenticated
  using (
    exists (
      select 1
      from public.broadcasts b
      where b.id = listener_sessions.broadcast_id
        and public.can_manage_event(b.event_id)
    )
  );
