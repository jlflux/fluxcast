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
6. [Database migrations and seed](#database-migrations-and-seed)
7. [Testing an RTMP broadcast](#testing-an-rtmp-broadcast)
8. [Deploying to Vercel](#deploying-to-vercel)
9. [Design decisions](#design-decisions)
10. [Project structure](#project-structure)

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
4. Put all three in `.env.local` (see [Environment variables](#environment-variables)).
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

| Variable | Required for | Exposed to browser | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Database | Yes | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Database | Yes | `sb_publishable_…`; RLS limits it to reads |
| `SUPABASE_SERVICE_ROLE_KEY` | Database | **No** | Bypasses RLS. Server only |
| `LIVEKIT_URL` | Streaming | No¹ | `wss://…livekit.cloud` |
| `LIVEKIT_API_KEY` | Streaming | No | |
| `LIVEKIT_API_SECRET` | Streaming | **No** | Signs listener tokens |

¹ The LiveKit URL reaches the browser only alongside a scoped listener token,
from a server route — never as a build-time public variable.

Each group is all-or-nothing: FluxCast switches to real Supabase only when all
three Supabase values are set, and to real LiveKit only when all three LiveKit
values are set. This avoids a confusing half-configured state.

**Never commit real credentials.**

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

Both are safe to re-run.

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
   for the Production (and Preview) environments. The three secrets must **not**
   be prefixed with `NEXT_PUBLIC_`.
4. Deploy.

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
    env.ts / env.server.ts Public vs. server-only environment access
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
