-- FluxCast seed data: Homewood High School, Homewood, Alabama.
--
-- Safe to re-run. Re-running also REPAIRS the sample games' kickoff times and
-- statuses, so it is the fix if the schedule ever looks wrong.
--
-- Kickoff times are relative to today so the sample schedule stays realistic
-- while you develop. They are computed in the school's local timezone: a game
-- is at 7:00 PM in Homewood, not 7:00 PM UTC. Doing this with a plain
-- `date_trunc('day', now())` would truncate in the *session* timezone (UTC on
-- Supabase) and land every game at 2:00 PM Central.
--
-- The slugs here match the built-in mock fixtures, so switching from mock mode
-- to Supabase keeps the same URLs.

-- Everything runs in one transaction: the temp table below must survive across
-- statements (under autocommit, ON COMMIT DROP would remove it immediately),
-- and an all-or-nothing seed is easier to reason about anyway.
begin;

-- School -------------------------------------------------------------------
insert into public.schools
  (name, slug, short_name, mascot, city, state, primary_color, secondary_color, active)
values
  ('Homewood High School', 'homewood', 'Homewood', 'Patriots',
   'Homewood', 'Alabama', '#B3262F', '#101010', true)
on conflict (slug) do update
  set name            = excluded.name,
      short_name      = excluded.short_name,
      mascot          = excluded.mascot,
      city            = excluded.city,
      state           = excluded.state,
      primary_color   = excluded.primary_color,
      secondary_color = excluded.secondary_color,
      active          = excluded.active;

-- Sport --------------------------------------------------------------------
insert into public.sports (name, slug)
values ('Football', 'football')
on conflict (slug) do update set name = excluded.name;

-- Team ---------------------------------------------------------------------
insert into public.teams (school_id, sport_id, level, gender)
select s.id, sp.id, 'Varsity', 'boys'
from public.schools s
cross join public.sports sp
where s.slug = 'homewood' and sp.slug = 'football'
on conflict (school_id, sport_id, level, gender) do nothing;

-- Sample games -------------------------------------------------------------
-- Held in a temp table so the insert and the repair below agree on one list.
create temporary table _fluxcast_seed on commit drop as
select *,
       -- Midnight in Homewood, shifted by days_out, then 19:00 local.
       ((date_trunc('day', now() at time zone 'America/Chicago')
         + (days_out || ' days')::interval
         + interval '19 hours') at time zone 'America/Chicago') as start_time
from (
  values
    ('Mountain Brook', true, 0, 'Waldrop Stadium, Homewood, AL',
     'homewood-vs-mountain-brook', 'Homewood vs. Mountain Brook',
     'scheduled', 'draft'),
    ('Vestavia Hills', false, 7, 'Thompson Reynolds Stadium, Vestavia Hills, AL',
     'homewood-at-vestavia-hills', 'Homewood at Vestavia Hills',
     'scheduled', 'draft'),
    ('Briarwood Christian', true, 14, 'Waldrop Stadium, Homewood, AL',
     'homewood-vs-briarwood-christian', 'Homewood vs. Briarwood Christian',
     'scheduled', 'draft'),
    ('Hoover', false, -7, 'Hoover Metropolitan Stadium, Hoover, AL',
     'homewood-at-hoover', 'Homewood at Hoover',
     'final', 'ended')
) as v (opponent, is_home, days_out, location, slug, title,
        event_status, broadcast_status);

-- Insert anything missing. Broadcasts start as 'draft': no LiveKit ingress
-- yet. Create one from /admin to move a broadcast to 'ready'.
with team as (
  select t.id as team_id, t.sport_id
  from public.teams t
  join public.schools s on s.id = t.school_id
  join public.sports  p on p.id = t.sport_id
  where s.slug = 'homewood' and p.slug = 'football' and t.level = 'Varsity'
  limit 1
),
inserted_events as (
  insert into public.events (sport_id, team_id, opponent_name, is_home, start_time, location, status)
  select team.sport_id, team.team_id, s.opponent, s.is_home, s.start_time, s.location, s.event_status
  from _fluxcast_seed s
  cross join team
  where not exists (select 1 from public.broadcasts b where b.slug = s.slug)
  returning id, opponent_name, start_time
)
insert into public.broadcasts
  (event_id, title, slug, status, scheduled_start, started_at, ended_at)
select e.id,
       s.title,
       s.slug,
       s.broadcast_status,
       e.start_time,
       case when s.broadcast_status = 'ended' then e.start_time end,
       case when s.broadcast_status = 'ended' then e.start_time + interval '3 hours' end
from inserted_events e
join _fluxcast_seed s on s.opponent = e.opponent_name
on conflict (slug) do nothing;

-- Repair: bring existing sample rows back in line with the list above. This is
-- what makes a re-run fix a wrong schedule. Only the four sample slugs are
-- touched; broadcasts you created yourself are left alone.
update public.events e
set start_time = s.start_time,
    location   = s.location,
    status     = s.event_status
from _fluxcast_seed s
join public.broadcasts b on b.slug = s.slug
where e.id = b.event_id
  and e.start_time is distinct from s.start_time;

update public.broadcasts b
set scheduled_start = e.start_time,
    started_at      = case when b.status = 'ended' then e.start_time end,
    ended_at        = case when b.status = 'ended' then e.start_time + interval '3 hours' end
from public.events e, _fluxcast_seed s
where e.id = b.event_id
  and b.slug = s.slug
  and b.scheduled_start is distinct from e.start_time;

commit;
