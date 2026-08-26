# FluxCast

A centralized live sports audio network for high schools.

Schools send their existing live audio broadcast feed to FluxCast; fans go to one
place to find the game and listen. No app, no account, no sign-up.

This repository is a working prototype scoped to **one school: Homewood High
School, Homewood, Alabama.** It proves one path end to end:

```
Homewood broadcast audio
  → OBS or Restream
    → LiveKit Cloud (RTMP ingress)
      → FluxCast web app
        → public listener
```

---

## Table of contents

1. [Architecture](#architecture)
2. [Local development](#local-development)
3. [Supabase setup](#supabase-setup)
4. [LiveKit setup](#livekit-setup)
5. [Environment variables](#environment-variables)
6. [Diagnostics](#diagnostics)
7. [Database migrations and seed](#database-migrations-and-seed)
8. [Testing an RTMP broadcast](#testing-an-rtmp-broadcast)
9. [Deploying to Vercel](#deploying-to-vercel)
10. [Design decisions](#design-decisions)
11. [Project structure](#project-structure)

---

## Architecture

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 ·
Supabase (Postgres + Auth) · LiveKit Cloud · deployed on Vercel.

The whole app is built around **two swappable seams**, which is what lets it run
before any external account exists:

| Seam | Real implementation | Stand-in | Chosen by |
|---|---|---|---|
| Data | `src/lib/data/supabase.ts` | `src/lib/data/mock.ts` | Supabase env vars present |
| Streaming | `src/lib/livekit/service.ts` | same file, mock branch | LiveKit env vars present |

Every page and action talks to the `DataSource` interface
(`src/lib/data/source.ts`) and the LiveKit service functions — never to
Supabase or LiveKit directly. When credentials are missing, FluxCast runs in
**development mode**: in-memory sample data and clearly labelled placeholder
stream credentials, with an amber banner on every page saying so. Nothing ever
silently pretends an external service is connected.

**Request flow for a listener:**

1. Fan opens `/broadcasts/homewood-vs-mountain-brook`.
2. The server renders the page, asking LiveKit whether audio is actually
   arriving on that broadcast's ingress.
3. If it is live, the fan taps **LISTEN LIVE**.
4. The browser POSTs to `/api/broadcasts/[slug]/listen`.
5. The server mints a short-lived, **subscribe-only** LiveKit token scoped to
   that one room and returns it with the websocket URL.
6. `livekit-client` connects and attaches the audio track.

`LIVEKIT_API_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` are used only in modules
that import `server-only`, so importing them into a Client Component is a build
error rather than a silent leak.

---

## Local development

Requires Node.js 20.9+ (Node 22 recommended).

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. **No credentials are needed.** You'll see the
Homewood sample schedule, a live broadcast, the broadcast page and the admin
dashboard, all running on stand-in data.

Useful commands:

```bash
npm run dev         # dev server (Turbopack)
npm run build       # production build
npm run start       # serve the production build
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
```

### What works without credentials

- The full public site and admin interface
- Creating broadcasts (stored in memory; resets when the dev server restarts)
- Generating a placeholder stream destination labelled `DEVELOPMENT ONLY`
- A **Simulate stream status** panel on each broadcast, so you can walk a
  broadcast through Ready → Connected → Live → Ended and see every screen. This
  panel disappears automatically once LiveKit is configured.

---

## Supabase setup

Milestone 2: persist real events and broadcasts.

1. Create a project at <https://supabase.com/dashboard>. Save the database
   password somewhere safe.
2. In **Project Settings → Data API**, copy the **Project URL**.
3. In **Project Settings → API Keys**, copy:
   - the **publishable key** (`sb_publishable_…`) — safe for the browser
   - the **secret / service_role key** — server only, never expose it
4. Put all three in `.env.local` as `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`
   and `SUPABASE_SERVICE_ROLE_KEY` (see
   [Environment variables](#environment-variables) — note there is deliberately
   no `NEXT_PUBLIC_` prefix).
5. Run the migration and seed (next section).
6. Restart `npm run dev`. The amber banner should stop mentioning Supabase.

**Authentication is not wired up yet.** `/admin` currently has no sign-in and
shows a red UNPROTECTED banner. The single place to add it is
`requireAdmin()` in `src/lib/auth.ts`, which every admin page and every admin
server action already calls. Do not deploy the admin area publicly until that
is implemented.

---

## LiveKit setup

Milestone 3: generate a real RTMP destination.

1. Create a project at <https://cloud.livekit.io>.
2. **Settings → Project** → copy the **WebSocket URL**
   (`wss://your-project.livekit.cloud`). Either `wss://` or `https://` works —
   FluxCast converts between them.
3. **Settings → API Keys** → create a key, then copy the **API key** and
   **API secret**.
4. Put all three in `.env.local` and restart the dev server.

Ingress must be enabled on your LiveKit Cloud project. It is on by default for
Cloud projects; if `Generate stream destination` fails, check the project's
Ingress settings first.

---

## Environment variables

Copy `.env.example` to `.env.local` and fill it in. `.env.local` is git-ignored.

| Variable | Required for | Notes |
|---|---|---|
| `SUPABASE_URL` | Database | Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Database | `sb_publishable_…`; RLS limits it to reads |
| `SUPABASE_SERVICE_ROLE_KEY` | Database | Bypasses RLS. Treat like a database password |
| `LIVEKIT_URL` | Streaming | `wss://…livekit.cloud` |
| `LIVEKIT_API_KEY` | Streaming | |
| `LIVEKIT_API_SECRET` | Streaming | Signs listener tokens |

**None of these are exposed to the browser, and none should have a
`NEXT_PUBLIC_` prefix.** All six are read on the server at runtime. The LiveKit
URL does reach the browser, but only alongside a scoped listener token, handed
out by a server route.

Each group is all-or-nothing: FluxCast switches to real Supabase only when all
three Supabase values are set, and to real LiveKit only when all three LiveKit
values are set. This avoids a confusing half-configured state.

**Never commit real credentials.**

### Why no `NEXT_PUBLIC_` prefix

Next.js treats the two kinds of variable very differently:

| | `NEXT_PUBLIC_FOO` | `FOO` |
|---|---|---|
| Resolved | Build time, inlined as a literal | Runtime, read from the environment |
| Visible to | Browser **and** server | Server only |
| Change without rebuilding | No | Yes |

The build-time behaviour is the trap. Vercel and similar hosts let you classify
a variable as a secret, and a secret may not be present during the build — so a
`NEXT_PUBLIC_` variable can bake in as an empty string and the deployed site
silently falls back to sample data, with no error anywhere. Those dashboards
also warn (or refuse) when you mark a `NEXT_PUBLIC_` variable as sensitive,
because the prefix means "ship this to browsers".

Since nothing in FluxCast reads Supabase config in the browser — both Supabase
clients are server-side — the plain names are simply correct here.

For compatibility, `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are still accepted as a fallback, since
some hosting integrations create them for you. The plain names win when both
are set.

When the admin login form eventually needs a browser Supabase client, pass the
URL and publishable key down from a Server Component as props rather than
reintroducing a build-time public variable.

---

## Diagnostics

`/admin/diagnostics` is a configuration self-check. Open it whenever FluxCast
says **Development mode** and you expected it not to. The banner links straight
to it.

It reports, for the *running server*:

- Which mode data and streaming are in
- Which build is deployed (Vercel environment, branch, commit)
- For each of the six variables: present or missing, **which variable name
  supplied it**, and whether a fallback name was used
- Whether the database actually answers, for both the publishable key (the path
  fans use, through RLS) and the service role key (the path admin writes use)
- Row counts per table, which tells you whether the migration and the seed both
  ran

Secret values are never displayed — only presence and character count, which is
enough to catch a truncated paste.

### If a deployment says "not configured" after you added the variables

The most common cause is that **environment variables apply when a deployment is
created, not retroactively.** Adding them in the dashboard does nothing to a
deployment that already exists — you have to redeploy. Check the commit shown
under **Deployment** on the diagnostics page against your latest push.

Other causes it will identify for you:

| Diagnostics shows | Cause |
|---|---|
| A variable `missing` | Not set, or set in a different Vercel environment (Production vs. Preview) than the one you're viewing |
| `read from NEXT_PUBLIC_…  — fallback name` | Works, but rename it to the plain name |
| Variables present, public read fails | RLS policies didn't run — re-run the migration |
| Variables present, service read fails | Service role key is wrong |
| All tables `0 rows` | Migration ran, seed didn't — run `supabase/seed.sql` |

---

## Database migrations and seed

SQL lives in `supabase/`:

- `migrations/0001_init.sql` — tables, constraints, indexes, RLS policies
- `seed.sql` — Homewood High School, Football, Varsity Football, and four
  sample games

The prototype has no migration tooling — for two files, the Supabase SQL editor
is enough:

1. Open your project → **SQL Editor** → **New query**.
2. Paste `supabase/migrations/0001_init.sql`, run it.
3. Paste `supabase/seed.sql`, run it.

Both are safe to re-run. Re-running `seed.sql` also **repairs** the four sample
games' kickoff times, locations and statuses, so it is the fix if the sample
schedule ever looks wrong. Broadcasts you created yourself are never touched.

Kickoff times are computed in the school's local timezone. A plain
`date_trunc('day', now())` would truncate in the *session* timezone — UTC on
Supabase — and put every sample game at 2:00 PM Central instead of 7:00 PM.

If you'd rather use the CLI:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push          # applies migrations/
npx supabase db execute --file supabase/seed.sql
```

### Data model notes

`schools → teams → events → broadcasts`, with `sports` referenced by both teams
and events.

Two places the schema departs from an obvious first draft, both deliberate:

**Opponents are free text, not schools.** An `event` references *our* team
(`team_id`) plus `opponent_name` and `is_home`. Opponents don't have FluxCast
accounts and only one school is onboarded, so a second team foreign key would be
dead weight. `is_home` is what makes the matchup read "Homewood vs. Mountain
Brook" or "Homewood at Vestavia Hills". When FluxCast onboards opponents for
real, `opponent_name` becomes a nullable `opponent_team_id`.

**Status columns are `TEXT` + `CHECK`, not Postgres `ENUM`.** Adding a value to
an enum is a migration; editing a check constraint is one line.

### Why we don't store stream keys

The `broadcasts` table has **no `stream_key` column**, on purpose.

A stream key is a credential: anyone holding it can publish audio into your
broadcast. Storing it in Postgres means it now lives in your database, your
backups, and every query result that does `select *` — and it would need
encryption at rest, a key-management story, and a rotation path to be handled
responsibly.

None of that is necessary, because **LiveKit is already the system of record.**
`IngressClient.listIngress({ ingressId })` returns the stream URL and key for an
ingress on demand. So FluxCast stores only the non-secret `livekit_ingress_id`
and `stream_url`, and fetches the key server-side, at view time, whenever an
admin opens the broadcast page. The key never touches our database and is
masked in the UI until an operator asks to see it.

This is also why development mode *derives* its placeholder key from a hash of
the ingress ID rather than storing one — mock mode behaves the same way as the
real thing.

### Row Level Security

RLS is enabled on all five tables with SELECT-only policies for everyone. Fans
browse without an account, so public reads are correct; nothing is writable with
the publishable key. All writes go through the service-role client, which only
ever runs on the server.

Verified against a real Postgres by connecting as the `anon` role: reads
succeed, `INSERT` is rejected with a row-level security violation, and `UPDATE`
and `DELETE` affect zero rows.

---

## Testing an RTMP broadcast

Milestone 4 — the one that matters. You need Supabase and LiveKit configured.

1. **Create the broadcast.** Go to `/admin` → **Create Broadcast**. Homewood
   Varsity Football is preselected. Enter the opponent, home/away, date and
   time. Submit.
2. **Generate the destination.** On the broadcast page, click **Generate stream
   destination**. FluxCast creates a LiveKit room and an RTMP ingress bound to
   it, then shows:
   - **Stream URL** — e.g. `rtmps://your-project.livekitingress.cloud/live`
   - **Stream key** — masked; click **Reveal** or **Copy**
3. **Point your encoder at it.**

   *OBS:* Settings → Stream → Service: **Custom…** → paste the Stream URL into
   **Server** and the key into **Stream Key**. Under Settings → Output, an audio
   bitrate of 128 kbps is plenty for a game call. Click **Start Streaming**.

   *Restream:* add a **Custom RTMP** destination with the same two values.

4. **Watch the status.** The admin page moves `Ready → Connected → Live` on its
   own within a few seconds of the encoder connecting.
5. **Listen from another device.** Open
   `/broadcasts/<slug>` on a phone (same URL shown as *View public page*) and
   tap **LISTEN LIVE**. You should hear the broadcast.

**Troubleshooting**

| Symptom | Likely cause |
|---|---|
| Status stays `Ready` | Encoder isn't connecting. Re-check the URL and key; some encoders need the key pasted with no trailing space. |
| Status goes to `Error` | LiveKit rejected the stream. Check your encoder's audio codec (AAC) and that video isn't being sent at an unsupported resolution. |
| Fan sees "couldn't connect" | Open the browser console — the underlying error is logged there. Fans only ever see plain language. |
| Nothing plays on iPhone | Audio must start from a tap. Make sure you're tapping LISTEN LIVE rather than expecting autoplay. |

---

## Deploying to Vercel

1. Push this repository to GitHub.
2. In Vercel, **Add New → Project**, import the repo. Next.js is detected
   automatically; no build settings to change.
3. Add all six environment variables under **Settings → Environment Variables**
   for the Production (and Preview) environments. None of them take a
   `NEXT_PUBLIC_` prefix, so all six can be stored as secrets without Vercel
   objecting — see [Why no `NEXT_PUBLIC_` prefix](#why-no-next_public_-prefix).
4. Deploy. **If you add or change a variable later, redeploy** — Vercel applies
   environment variables when a deployment is created, not retroactively.
5. Open `/admin/diagnostics` on the deployed site to confirm what it can see.

Everything is serverless-compatible: no long-running processes, no websocket
server of our own, no filesystem writes. Audio never flows through Vercel — the
browser connects to LiveKit directly.

> **Before deploying publicly**, implement `requireAdmin()` in
> `src/lib/auth.ts`. Until then `/admin` is open to anyone who finds the URL.

---

## Design decisions

### Stream status: polling, not webhooks

LiveKit's ingress API already exposes exactly the state machine FluxCast wants:

| LiveKit `IngressState.Status` | FluxCast status |
|---|---|
| `ENDPOINT_INACTIVE` | `ready` (or `ended`, if it had been live) |
| `ENDPOINT_BUFFERING` | `connected` |
| `ENDPOINT_PUBLISHING` | `live` |
| `ENDPOINT_ERROR` | `error` |
| `ENDPOINT_COMPLETE` | `ended` |

So a status check is one API call with a direct mapping
(`src/lib/livekit/status.ts`). Webhooks would need a publicly reachable HTTPS
endpoint plus signature verification — meaning a tunnel before you can test
anything locally — for no extra information. That is real infrastructure to
maintain, and the prototype gets nothing for it.

FluxCast therefore polls (`src/lib/livekit/sync.ts`), with a 5-second
server-side throttle per ingress so repeated page views don't hammer LiveKit.
The listener page re-checks every 15 seconds; the admin dashboard every 10
seconds while something is scheduled today, every 60 otherwise.

Webhooks become worth it when FluxCast needs sub-second state changes or is
running many concurrent broadcasts. One school does not.

### Listener security

Fans never sign in, so the `/api/broadcasts/[slug]/listen` route is public. What
makes that safe is the shape of what it hands out:

- The token is minted **server-side**; `LIVEKIT_API_SECRET` never reaches the
  browser.
- The grant is `canSubscribe: true` with `canPublish: false` and
  `canPublishData: false`, scoped to that broadcast's room. A listener cannot
  publish audio into the broadcast, use a data channel, or reach another room.
- Listeners are `hidden`, so they don't appear in the participant list and
  can't be enumerated by other listeners.
- Tokens are only issued while a broadcast is actually live, so they can't be
  farmed ahead of time.
- Room names include a random suffix, so they aren't guessable from a slug.

### Timezones

Every time on the site renders in the school's local timezone
(`America/Chicago`), not the viewer's. A high-school game time means "7:00 PM in
Homewood" no matter where the fan is. Pinning the zone also keeps
server-rendered markup identical to the client's, avoiding hydration mismatch.
When FluxCast adds schools outside Central time, this becomes a per-school
field — see `SITE_TIME_ZONE` in `src/lib/format.ts`.

### Design language

The public site is a dark broadcast surface with one restrained accent (flux
cyan) for interactive emphasis. Broadcast red is reserved **exclusively** for
the LIVE state and used nowhere else, so red always means "on the air". The
FluxCast wordmark is deliberately text-only — a placeholder, not a designed
logo. The admin area uses conventional cards and tables.

---

## Project structure

```
src/
  app/
    (public)/              Fan-facing site (route group, shared header/footer)
      page.tsx               Homepage: LIVE NOW + UPCOMING
      schools/[slug]/        School page
      broadcasts/[slug]/     Broadcast page + player
    admin/                 Admin area
      page.tsx               Dashboard: live / today / upcoming
      broadcasts/new/        Create broadcast form
      broadcasts/[id]/       Manage a broadcast, stream credentials
      diagnostics/           Configuration self-check
    api/broadcasts/[slug]/
      listen/route.ts        Mints listen-only LiveKit tokens
      status/route.ts        Current broadcast status (polled)
  actions/                 Server Actions ("use server")
  components/
    ui/                    Wordmark, LiveBadge, StatusPill, CopyButton, SecretField
    public/                Header, footer, game cards, school crest
    player/                LiveKit audio player + status watcher (client)
    admin/                 Dashboard table, create form, stream destination
  lib/
    data/                  DataSource interface + mock and Supabase impls
    livekit/               Ingress, tokens, status mapping, status sync
    supabase/              Client factories and database types
    auth.ts                requireAdmin() — the single admin authorization point
    diagnostics.ts         Configuration self-check data
    env.server.ts         Server-only environment access + mode detection
    format.ts, slug.ts, types.ts
supabase/
  migrations/0001_init.sql
  seed.sql
```

---

## Not in scope

Deliberately not built: native apps, video, payments, ads and sponsors, scores
and stats, notifications, favorites, chat, podcast feeds, AI features, multiple
states, analytics. The MVP is one school, one sport, one working audio path.
