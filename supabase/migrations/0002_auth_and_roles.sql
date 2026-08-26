-- FluxCast: admin accounts, roles, and multi-school scoping.
--
-- Two roles:
--   super_admin  - FluxCast staff. Manages every school, team and broadcast,
--                  and creates accounts for partner schools.
--   school_admin - A partner school's broadcaster. Sees and manages only their
--                  own school's teams and broadcasts.
--
-- A super_admin may also carry a school_id, which is their "home" school for
-- convenience (defaults on the create form). It never limits what they can see.

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text        not null,
  full_name  text,
  role       text        not null default 'school_admin'
               check (role in ('super_admin', 'school_admin')),
  school_id  uuid references public.schools (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists profiles_school_id_idx on public.profiles (school_id);

-- ---------------------------------------------------------------------------
-- Authorization helpers
--
-- All SECURITY DEFINER so they can read `profiles` without tripping the RLS
-- policies defined on `profiles` itself — a policy that queries its own table
-- recurses infinitely otherwise.
-- ---------------------------------------------------------------------------
create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role() = 'super_admin', false);
$$;

create or replace function public.current_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select school_id from public.profiles where id = auth.uid();
$$;

/* True when the signed-in admin may manage this school. */
create or replace function public.can_manage_school(target_school uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (p.role = 'super_admin' or p.school_id = target_school)
  );
$$;

/* True when the signed-in admin may manage this team (via its school). */
create or replace function public.can_manage_team(target_team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.teams t
    join public.profiles p on p.id = auth.uid()
    where t.id = target_team
      and (p.role = 'super_admin' or p.school_id = t.school_id)
  );
$$;

/* True when the signed-in admin may manage the broadcast attached to an event. */
create or replace function public.can_manage_event(target_event uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events e
    join public.teams t on t.id = e.team_id
    join public.profiles p on p.id = auth.uid()
    where e.id = target_event
      and (p.role = 'super_admin' or p.school_id = t.school_id)
  );
$$;

-- ---------------------------------------------------------------------------
-- Create a profile automatically whenever an auth user is created.
--
-- Role and school can be seeded from the invite's user metadata; otherwise a
-- new account is the least-privileged option (school_admin, no school) until a
-- super admin assigns it.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, school_id)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    case
      when new.raw_user_meta_data ->> 'role' = 'super_admin' then 'super_admin'
      else 'school_admin'
    end,
    nullif(new.raw_user_meta_data ->> 'school_id', '')::uuid
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Writes still go through the service-role client, which bypasses RLS — the
-- app enforces authorization in `requireAdmin()` and the server actions. These
-- policies are the second line of defence, so a mistake in app code cannot let
-- one school's admin touch another school's data through the anon key.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_super_admin());

drop policy if exists "admins manage schools"    on public.schools;
drop policy if exists "admins manage teams"      on public.teams;
drop policy if exists "admins manage events"     on public.events;
drop policy if exists "admins manage broadcasts" on public.broadcasts;

create policy "admins manage schools" on public.schools
  for all to authenticated
  using (public.can_manage_school(id))
  with check (public.is_super_admin());

create policy "admins manage teams" on public.teams
  for all to authenticated
  using (public.can_manage_school(school_id))
  with check (public.can_manage_school(school_id));

create policy "admins manage events" on public.events
  for all to authenticated
  using (public.can_manage_team(team_id))
  with check (public.can_manage_team(team_id));

create policy "admins manage broadcasts" on public.broadcasts
  for all to authenticated
  using (public.can_manage_event(event_id))
  with check (public.can_manage_event(event_id));
