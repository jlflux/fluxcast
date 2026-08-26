import type {
  Broadcast,
  BroadcastView,
  CreateBroadcastInput,
  CreateSchoolInput,
  CreateTeamInput,
  GameEvent,
  School,
  Sport,
  Team,
  UpdateBroadcastInput,
} from "@/lib/types";
import { buildBroadcastSlug, buildMatchup, slugify } from "@/lib/slug";
import type { BroadcastPatch, DataSource, TeamOption } from "@/lib/data/source";

/**
 * In-memory data source used when Supabase is not configured.
 *
 * This exists so the entire interface can be built, demoed and reviewed before
 * any external account is created. Data lives in module state: it survives
 * navigation but resets when the dev server restarts, and it is per-instance,
 * so it is only ever appropriate for local development.
 */

const HOMEWOOD: School = {
  id: "school-homewood",
  name: "Homewood High School",
  slug: "homewood",
  shortName: "Homewood",
  mascot: "Patriots",
  city: "Homewood",
  state: "Alabama",
  logoUrl: null,
  primaryColor: "#B3262F",
  secondaryColor: "#101010",
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const FOOTBALL: Sport = { id: "sport-football", name: "Football", slug: "football" };

const VARSITY_FOOTBALL: Team = {
  id: "team-homewood-varsity-football",
  schoolId: HOMEWOOD.id,
  sportId: FOOTBALL.id,
  level: "Varsity",
  gender: "boys",
  createdAt: "2026-01-01T00:00:00.000Z",
};

/**
 * Kickoff at 7:00 PM Central, `days` from today.
 *
 * Uses a fixed -05:00 (CDT) offset. Football season runs August through
 * November, entirely within daylight time, and these are throwaway dev
 * fixtures — not worth a timezone library.
 */
function kickoff(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
  return new Date(`${date}T19:00:00-05:00`).toISOString();
}

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

interface MockStore {
  schools: School[];
  sports: Sport[];
  teams: Team[];
  events: GameEvent[];
  broadcasts: Broadcast[];
  sequence: number;
}

function seed(): MockStore {
  const events: GameEvent[] = [
    {
      id: "event-mountain-brook",
      sportId: FOOTBALL.id,
      teamId: VARSITY_FOOTBALL.id,
      opponentName: "Mountain Brook",
      isHome: true,
      startTime: minutesAgo(35),
      location: "Waldrop Stadium, Homewood, AL",
      status: "live",
      createdAt: minutesAgo(60 * 24 * 20),
    },
    {
      id: "event-vestavia-hills",
      sportId: FOOTBALL.id,
      teamId: VARSITY_FOOTBALL.id,
      opponentName: "Vestavia Hills",
      isHome: false,
      startTime: kickoff(7),
      location: "Thompson Reynolds Stadium, Vestavia Hills, AL",
      status: "scheduled",
      createdAt: minutesAgo(60 * 24 * 20),
    },
    {
      id: "event-briarwood",
      sportId: FOOTBALL.id,
      teamId: VARSITY_FOOTBALL.id,
      opponentName: "Briarwood Christian",
      isHome: true,
      startTime: kickoff(14),
      location: "Waldrop Stadium, Homewood, AL",
      status: "scheduled",
      createdAt: minutesAgo(60 * 24 * 20),
    },
    {
      id: "event-hoover",
      sportId: FOOTBALL.id,
      teamId: VARSITY_FOOTBALL.id,
      opponentName: "Hoover",
      isHome: false,
      startTime: kickoff(-7),
      location: "Hoover Metropolitan Stadium, Hoover, AL",
      status: "final",
      createdAt: minutesAgo(60 * 24 * 30),
    },
  ];

  const broadcasts: Broadcast[] = [
    {
      id: "broadcast-mountain-brook",
      eventId: "event-mountain-brook",
      title: "Homewood vs. Mountain Brook",
      slug: "homewood-vs-mountain-brook",
      status: "live",
      livekitRoomName: "fluxcast-homewood-vs-mountain-brook-demo01",
      livekitIngressId: "IN_mockMountainBrook",
      streamUrl: "rtmps://example.livekit.cloud/x",
      scheduledStart: minutesAgo(35),
      startedAt: minutesAgo(38),
      endedAt: null,
      createdAt: minutesAgo(60 * 24 * 20),
    },
    {
      id: "broadcast-vestavia-hills",
      eventId: "event-vestavia-hills",
      title: "Homewood at Vestavia Hills",
      slug: "homewood-at-vestavia-hills",
      status: "draft",
      livekitRoomName: null,
      livekitIngressId: null,
      streamUrl: null,
      scheduledStart: kickoff(7),
      startedAt: null,
      endedAt: null,
      createdAt: minutesAgo(60 * 24 * 20),
    },
    {
      id: "broadcast-briarwood",
      eventId: "event-briarwood",
      title: "Homewood vs. Briarwood Christian",
      slug: "homewood-vs-briarwood-christian",
      status: "draft",
      livekitRoomName: null,
      livekitIngressId: null,
      streamUrl: null,
      scheduledStart: kickoff(14),
      startedAt: null,
      endedAt: null,
      createdAt: minutesAgo(60 * 24 * 20),
    },
    {
      id: "broadcast-hoover",
      eventId: "event-hoover",
      title: "Homewood at Hoover",
      slug: "homewood-at-hoover",
      status: "ended",
      livekitRoomName: "fluxcast-homewood-at-hoover-demo02",
      livekitIngressId: "IN_mockHoover",
      streamUrl: "rtmps://example.livekit.cloud/x",
      scheduledStart: kickoff(-7),
      startedAt: kickoff(-7),
      endedAt: kickoff(-7),
      createdAt: minutesAgo(60 * 24 * 30),
    },
  ];

  return {
    schools: [HOMEWOOD],
    sports: [FOOTBALL],
    teams: [VARSITY_FOOTBALL],
    events,
    broadcasts,
    sequence: 1,
  };
}

/**
 * Held on globalThis so the fixtures survive Next.js hot reloads in dev —
 * otherwise a broadcast you just created would vanish on the next file save.
 */
const globalForMock = globalThis as typeof globalThis & {
  __fluxcastMockStore?: MockStore;
};

function store(): MockStore {
  globalForMock.__fluxcastMockStore ??= seed();
  return globalForMock.__fluxcastMockStore;
}

function toView(db: MockStore, broadcast: Broadcast): BroadcastView | null {
  const event = db.events.find((e) => e.id === broadcast.eventId);
  if (!event) return null;
  const team = db.teams.find((t) => t.id === event.teamId);
  if (!team) return null;
  const school = db.schools.find((s) => s.id === team.schoolId);
  const sport = db.sports.find((s) => s.id === team.sportId);
  if (!school || !sport) return null;

  return {
    id: broadcast.id,
    slug: broadcast.slug,
    title: broadcast.title,
    status: broadcast.status,
    scheduledStart: broadcast.scheduledStart,
    startedAt: broadcast.startedAt,
    endedAt: broadcast.endedAt,
    livekitRoomName: broadcast.livekitRoomName,
    livekitIngressId: broadcast.livekitIngressId,
    streamUrl: broadcast.streamUrl,
    matchup: buildMatchup(school.shortName, event.opponentName, event.isHome),
    competition: `${team.level} ${sport.name}`,
    opponentName: event.opponentName,
    isHome: event.isHome,
    location: event.location,
    eventId: event.id,
    eventStatus: event.status,
    school,
    sport,
    team: { id: team.id, level: team.level, gender: team.gender },
  };
}

export class MockDataSource implements DataSource {
  readonly mode = "mock" as const;

  async listSchools(): Promise<School[]> {
    return store().schools;
  }

  async getSchoolBySlug(slug: string): Promise<School | null> {
    return store().schools.find((s) => s.slug === slug) ?? null;
  }

  async listSports(): Promise<Sport[]> {
    return store().sports;
  }

  async listTeamOptions(): Promise<TeamOption[]> {
    const db = store();
    return db.teams.flatMap((team) => {
      const school = db.schools.find((s) => s.id === team.schoolId);
      const sport = db.sports.find((s) => s.id === team.sportId);
      if (!school || !sport) return [];
      return [
        {
          id: team.id,
          schoolId: school.id,
          schoolName: school.name,
          schoolShortName: school.shortName,
          sportId: sport.id,
          sportName: sport.name,
          level: team.level,
          label: `${school.shortName} ${team.level} ${sport.name}`,
        },
      ];
    });
  }

  async listBroadcasts(options?: { schoolSlug?: string }): Promise<BroadcastView[]> {
    const db = store();
    const views = db.broadcasts
      .map((b) => toView(db, b))
      .filter((v): v is BroadcastView => v !== null);
    if (!options?.schoolSlug) return views;
    return views.filter((v) => v.school.slug === options.schoolSlug);
  }

  async getBroadcastBySlug(slug: string): Promise<BroadcastView | null> {
    const db = store();
    const broadcast = db.broadcasts.find((b) => b.slug === slug);
    return broadcast ? toView(db, broadcast) : null;
  }

  async getBroadcastById(id: string): Promise<BroadcastView | null> {
    const db = store();
    const broadcast = db.broadcasts.find((b) => b.id === id);
    return broadcast ? toView(db, broadcast) : null;
  }

  async createBroadcast(input: CreateBroadcastInput): Promise<BroadcastView> {
    const db = store();
    const team = db.teams.find((t) => t.id === input.teamId);
    if (!team) throw new Error(`Unknown team: ${input.teamId}`);
    const school = db.schools.find((s) => s.id === team.schoolId);
    if (!school) throw new Error(`Team ${team.id} has no school`);

    const n = db.sequence++;
    const matchup = buildMatchup(school.shortName, input.opponentName, input.isHome);
    const baseSlug = buildBroadcastSlug(school.shortName, input.opponentName, input.isHome);
    const slug = db.broadcasts.some((b) => b.slug === baseSlug)
      ? `${baseSlug}-${slugify(input.startTime.slice(0, 10))}`
      : baseSlug;

    const event: GameEvent = {
      id: `event-${n}`,
      sportId: team.sportId,
      teamId: team.id,
      opponentName: input.opponentName,
      isHome: input.isHome,
      startTime: input.startTime,
      location: input.location,
      status: "scheduled",
      createdAt: new Date().toISOString(),
    };
    db.events.push(event);

    const broadcast: Broadcast = {
      id: `broadcast-${n}`,
      eventId: event.id,
      title: input.title?.trim() || matchup,
      slug,
      status: "draft",
      livekitRoomName: null,
      livekitIngressId: null,
      streamUrl: null,
      scheduledStart: input.startTime,
      startedAt: null,
      endedAt: null,
      createdAt: new Date().toISOString(),
    };
    db.broadcasts.push(broadcast);

    const view = toView(db, broadcast);
    if (!view) throw new Error("Failed to build the new broadcast");
    return view;
  }

  async updateBroadcastDetails(
    id: string,
    input: UpdateBroadcastInput,
  ): Promise<BroadcastView | null> {
    const db = store();
    const broadcast = db.broadcasts.find((b) => b.id === id);
    if (!broadcast) return null;
    const event = db.events.find((e) => e.id === broadcast.eventId);
    if (!event) return null;

    event.opponentName = input.opponentName;
    event.startTime = input.startTime;
    event.isHome = input.isHome;
    event.location = input.location;

    broadcast.title = input.title;
    broadcast.scheduledStart = input.startTime;

    return toView(db, broadcast);
  }

  async createSchool(input: CreateSchoolInput): Promise<School> {
    const db = store();
    const n = db.sequence++;
    const slug = slugify(input.name);
    if (db.schools.some((s) => s.slug === slug)) {
      throw new Error(`A school with the address "${slug}" already exists.`);
    }
    const school: School = {
      id: `school-${n}`,
      name: input.name,
      slug,
      shortName: input.shortName,
      mascot: input.mascot,
      city: input.city,
      state: input.state,
      logoUrl: null,
      primaryColor: input.primaryColor,
      secondaryColor: null,
      active: true,
      createdAt: new Date().toISOString(),
    };
    db.schools.push(school);
    return school;
  }

  async createTeam(input: CreateTeamInput): Promise<TeamOption> {
    const db = store();
    const school = db.schools.find((s) => s.id === input.schoolId);
    const sport = db.sports.find((s) => s.id === input.sportId);
    if (!school || !sport) throw new Error("Unknown school or sport.");
    if (
      db.teams.some(
        (t) =>
          t.schoolId === input.schoolId &&
          t.sportId === input.sportId &&
          t.level === input.level &&
          t.gender === input.gender,
      )
    ) {
      throw new Error(`${school.shortName} already has a ${input.level} ${sport.name} team.`);
    }

    const team: Team = {
      id: `team-${db.sequence++}`,
      schoolId: school.id,
      sportId: sport.id,
      level: input.level,
      gender: input.gender,
      createdAt: new Date().toISOString(),
    };
    db.teams.push(team);

    return {
      id: team.id,
      schoolId: school.id,
      schoolName: school.name,
      schoolShortName: school.shortName,
      sportId: sport.id,
      sportName: sport.name,
      level: team.level,
      label: `${school.shortName} ${team.level} ${sport.name}`,
    };
  }

  async updateBroadcast(id: string, patch: BroadcastPatch): Promise<BroadcastView | null> {
    const db = store();
    const broadcast = db.broadcasts.find((b) => b.id === id);
    if (!broadcast) return null;
    Object.assign(broadcast, patch);
    return toView(db, broadcast);
  }
}
