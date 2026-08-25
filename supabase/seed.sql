-- FluxCast seed data: Homewood High School, Homewood, Alabama.
--
-- Safe to re-run. Event start times are relative to now() so the sample games
-- stay realistic while you develop. The slugs here match the built-in mock
-- fixtures, so switching from mock mode to Supabase keeps the same URLs.

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

-- Events + broadcasts ------------------------------------------------------
-- Broadcasts are seeded as 'draft': they have no LiveKit ingress yet. Create
-- one from /admin to move a broadcast to 'ready'.
with team as (
  select t.id as team_id, t.sport_id
  from public.teams t
  join public.schools s on s.id = t.school_id
  join public.sports  p on p.id = t.sport_id
  where s.slug = 'homewood' and p.slug = 'football' and t.level = 'Varsity'
  limit 1
),
sample (opponent, is_home, days_out, location, slug, title, event_status, broadcast_status) as (
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
),
inserted_events as (
  insert into public.events (sport_id, team_id, opponent_name, is_home, start_time, location, status)
  select team.sport_id,
         team.team_id,
         sample.opponent,
         sample.is_home,
         date_trunc('day', now()) + (sample.days_out || ' days')::interval + interval '19 hours',
         sample.location,
         sample.event_status
  from sample
  cross join team
  where not exists (select 1 from public.broadcasts b where b.slug = sample.slug)
  returning id, start_time, opponent_name
)
insert into public.broadcasts
  (event_id, title, slug, status, scheduled_start, started_at, ended_at)
select e.id,
       sample.title,
       sample.slug,
       sample.broadcast_status,
       e.start_time,
       case when sample.broadcast_status = 'ended' then e.start_time else null end,
       case when sample.broadcast_status = 'ended'
            then e.start_time + interval '3 hours' else null end
from inserted_events e
join sample on sample.opponent = e.opponent_name
on conflict (slug) do nothing;
