/**
 * FluxCast domain types.
 *
 * These mirror the SQL schema in `supabase/migrations/`, but are written in
 * application (camelCase) form. The data layer is responsible for translating
 * between the two. UI code should only ever see these types.
 */

/** Lifecycle of a game. */
export const EVENT_STATUSES = ["scheduled", "live", "final", "cancelled"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

/**
 * Lifecycle of a broadcast.
 *
 * draft     - created in FluxCast, no LiveKit ingress yet
 * ready     - ingress exists, waiting for the encoder to connect
 * connected - encoder has connected, LiveKit is buffering
 * live      - audio is flowing and listeners can hear it
 * ended     - the broadcast finished normally
 * error     - LiveKit reported a problem with the ingress
 */
export const BROADCAST_STATUSES = [
  "draft",
  "ready",
  "connected",
  "live",
  "ended",
  "error",
] as const;
export type BroadcastStatus = (typeof BROADCAST_STATUSES)[number];

/** Statuses a fan should see a "Listen Live" button for. */
export const LISTENABLE_STATUSES: readonly BroadcastStatus[] = ["live"];

export interface School {
  id: string;
  name: string;
  slug: string;
  shortName: string;
  mascot: string | null;
  city: string | null;
  state: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  active: boolean;
  createdAt: string;
}

export interface Sport {
  id: string;
  name: string;
  slug: string;
}

export interface Team {
  id: string;
  schoolId: string;
  sportId: string;
  /** e.g. "Varsity", "Junior Varsity", "Freshman" */
  level: string;
  /** e.g. "boys", "girls", "coed". Null when the sport has a single team. */
  gender: string | null;
  createdAt: string;
}

/**
 * A game.
 *
 * The prototype only tracks one FluxCast school, so an event references *our*
 * team plus a free-text opponent, rather than two team foreign keys. `isHome`
 * records whether our team hosted. See README "Data model notes".
 */
export interface GameEvent {
  id: string;
  sportId: string;
  teamId: string;
  opponentName: string;
  isHome: boolean;
  startTime: string;
  location: string | null;
  status: EventStatus;
  createdAt: string;
}

export interface Broadcast {
  id: string;
  eventId: string;
  title: string;
  slug: string;
  status: BroadcastStatus;
  livekitRoomName: string | null;
  livekitIngressId: string | null;
  /**
   * The RTMP(S) ingest endpoint. This is *not* a secret — it is the same for
   * every ingress on a LiveKit project. The stream key is the secret half, and
   * FluxCast deliberately never stores it. See README "Why we don't store
   * stream keys".
   */
  streamUrl: string | null;
  scheduledStart: string;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
}

/**
 * A broadcast joined with everything the UI needs to render a card or page.
 * This is the single shape every screen consumes.
 */
export interface BroadcastView {
  id: string;
  slug: string;
  title: string;
  status: BroadcastStatus;
  scheduledStart: string;
  startedAt: string | null;
  endedAt: string | null;
  livekitRoomName: string | null;
  livekitIngressId: string | null;
  streamUrl: string | null;
  /** "Homewood vs. Mountain Brook" (home) or "Homewood at Vestavia Hills" (away). */
  matchup: string;
  /** "Varsity Football" */
  competition: string;
  opponentName: string;
  isHome: boolean;
  location: string | null;
  eventId: string;
  eventStatus: EventStatus;
  school: School;
  sport: Sport;
  team: Pick<Team, "id" | "level" | "gender">;
}

/** Payload accepted by the admin "create broadcast" form. */
export interface CreateBroadcastInput {
  teamId: string;
  opponentName: string;
  /** ISO-8601 instant for kickoff. */
  startTime: string;
  isHome: boolean;
  location: string | null;
  /** Optional override. When blank, FluxCast derives it from the matchup. */
  title: string | null;
}

/**
 * Admin roles.
 *
 * super_admin  - FluxCast staff. Every school, every broadcast, and can create
 *                schools, teams and other admin accounts.
 * school_admin - A partner school's broadcaster. Their own school only.
 */
export const ADMIN_ROLES = ["super_admin", "school_admin"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export interface AdminProfile {
  id: string;
  email: string;
  fullName: string | null;
  role: AdminRole;
  /** Home school. Required for school_admin; optional context for super_admin. */
  schoolId: string | null;
  createdAt: string;
}

/** Fields an admin may correct on an existing broadcast. */
export interface UpdateBroadcastInput {
  opponentName: string;
  startTime: string;
  isHome: boolean;
  location: string | null;
  title: string;
}

export interface CreateSchoolInput {
  name: string;
  shortName: string;
  mascot: string | null;
  city: string | null;
  state: string | null;
  primaryColor: string | null;
}

export interface CreateTeamInput {
  schoolId: string;
  sportId: string;
  level: string;
  gender: string | null;
}
