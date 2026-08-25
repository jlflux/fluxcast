import "server-only";

import type {
  BroadcastStatus,
  BroadcastView,
  CreateBroadcastInput,
  EventStatus,
  School,
  Sport,
} from "@/lib/types";
import { BROADCAST_STATUSES, EVENT_STATUSES } from "@/lib/types";
import { buildBroadcastSlug, buildMatchup } from "@/lib/slug";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { BroadcastPatch, DataSource, TeamOption } from "@/lib/data/source";
import type {
  BroadcastRow,
  EventRow,
  SchoolRow,
  SportRow,
  TeamRow,
} from "@/lib/supabase/types";

/**
 * The joined row PostgREST returns for the query below. Declared explicitly and
 * handed to `.returns<T>()` because inferring deeply nested embeds from the
 * hand-written Database type is more trouble than it is worth.
 */
type JoinedBroadcastRow = BroadcastRow & {
  event:
    | (EventRow & {
        sport: SportRow | null;
        team: (TeamRow & { school: SchoolRow | null }) | null;
      })
    | null;
};

const BROADCAST_SELECT = `
  id, event_id, title, slug, status, livekit_room_name, livekit_ingress_id,
  stream_url, scheduled_start, started_at, ended_at, created_at,
  event:events!inner (
    id, sport_id, team_id, opponent_name, is_home, start_time, location, status, created_at,
    sport:sports!inner ( id, name, slug ),
    team:teams!inner (
      id, school_id, sport_id, level, gender, created_at,
      school:schools!inner (
        id, name, slug, short_name, mascot, city, state, logo_url,
        primary_color, secondary_color, active, created_at
      )
    )
  )
`;

function toSchool(row: SchoolRow): School {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    shortName: row.short_name,
    mascot: row.mascot,
    city: row.city,
    state: row.state,
    logoUrl: row.logo_url,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    active: row.active,
    createdAt: row.created_at,
  };
}

function toSport(row: SportRow): Sport {
  return { id: row.id, name: row.name, slug: row.slug };
}

/** Guard against a status value drifting out of sync with the CHECK constraint. */
function toBroadcastStatus(value: string): BroadcastStatus {
  return (BROADCAST_STATUSES as readonly string[]).includes(value)
    ? (value as BroadcastStatus)
    : "error";
}

function toEventStatus(value: string): EventStatus {
  return (EVENT_STATUSES as readonly string[]).includes(value)
    ? (value as EventStatus)
    : "scheduled";
}

function toView(row: JoinedBroadcastRow): BroadcastView | null {
  const event = row.event;
  const team = event?.team;
  const school = team?.school;
  const sport = event?.sport;
  if (!event || !team || !school || !sport) return null;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: toBroadcastStatus(row.status),
    scheduledStart: row.scheduled_start,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    livekitRoomName: row.livekit_room_name,
    livekitIngressId: row.livekit_ingress_id,
    streamUrl: row.stream_url,
    matchup: buildMatchup(school.short_name, event.opponent_name, event.is_home),
    competition: `${team.level} ${sport.name}`,
    opponentName: event.opponent_name,
    isHome: event.is_home,
    location: event.location,
    eventId: event.id,
    eventStatus: toEventStatus(event.status),
    school: toSchool(school),
    sport: toSport(sport),
    team: { id: team.id, level: team.level, gender: team.gender },
  };
}

/** Supabase errors are logged server-side; callers get an empty result. */
function logQueryError(context: string, error: { message: string }): void {
  console.error(`[fluxcast] Supabase query failed (${context}): ${error.message}`);
}

export class SupabaseDataSource implements DataSource {
  readonly mode = "supabase" as const;

  async listSchools(): Promise<School[]> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("schools")
      .select("*")
      .eq("active", true)
      .order("name");
    if (error) {
      logQueryError("listSchools", error);
      return [];
    }
    return data.map(toSchool);
  }

  async getSchoolBySlug(slug: string): Promise<School | null> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("schools")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error) {
      logQueryError("getSchoolBySlug", error);
      return null;
    }
    return data ? toSchool(data) : null;
  }

  async listSports(): Promise<Sport[]> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from("sports").select("*").order("name");
    if (error) {
      logQueryError("listSports", error);
      return [];
    }
    return data.map(toSport);
  }

  async listTeamOptions(): Promise<TeamOption[]> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("teams")
      .select(
        "id, level, school:schools!inner ( id, name, short_name ), sport:sports!inner ( id, name )",
      )
      .returns<
        {
          id: string;
          level: string;
          school: { id: string; name: string; short_name: string } | null;
          sport: { id: string; name: string } | null;
        }[]
      >();
    if (error) {
      logQueryError("listTeamOptions", error);
      return [];
    }
    return data.flatMap((row) => {
      if (!row.school || !row.sport) return [];
      return [
        {
          id: row.id,
          schoolId: row.school.id,
          schoolName: row.school.name,
          schoolShortName: row.school.short_name,
          sportId: row.sport.id,
          sportName: row.sport.name,
          level: row.level,
          label: `${row.school.short_name} ${row.level} ${row.sport.name}`,
        },
      ];
    });
  }

  async listBroadcasts(options?: { schoolSlug?: string }): Promise<BroadcastView[]> {
    const supabase = await createServerSupabaseClient();
    let query = supabase.from("broadcasts").select(BROADCAST_SELECT);
    if (options?.schoolSlug) {
      query = query.eq("event.team.school.slug", options.schoolSlug);
    }
    const { data, error } = await query
      .order("scheduled_start", { ascending: true })
      .returns<JoinedBroadcastRow[]>();
    if (error) {
      logQueryError("listBroadcasts", error);
      return [];
    }
    return data.map(toView).filter((v): v is BroadcastView => v !== null);
  }

  private async getBroadcastBy(
    column: "slug" | "id",
    value: string,
  ): Promise<BroadcastView | null> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("broadcasts")
      .select(BROADCAST_SELECT)
      .eq(column, value)
      .maybeSingle()
      .returns<JoinedBroadcastRow | null>();
    if (error) {
      logQueryError(`getBroadcastBy_${column}`, error);
      return null;
    }
    return data ? toView(data) : null;
  }

  getBroadcastBySlug(slug: string): Promise<BroadcastView | null> {
    return this.getBroadcastBy("slug", slug);
  }

  getBroadcastById(id: string): Promise<BroadcastView | null> {
    return this.getBroadcastBy("id", id);
  }

  async createBroadcast(input: CreateBroadcastInput): Promise<BroadcastView> {
    const admin = createAdminSupabaseClient();

    const { data: team, error: teamError } = await admin
      .from("teams")
      .select("id, sport_id, school:schools!inner ( short_name )")
      .eq("id", input.teamId)
      .maybeSingle()
      .returns<{ id: string; sport_id: string; school: { short_name: string } | null } | null>();
    if (teamError) throw new Error(`Could not load the team: ${teamError.message}`);
    if (!team?.school) throw new Error("That team no longer exists.");

    const shortName = team.school.short_name;
    const matchup = buildMatchup(shortName, input.opponentName, input.isHome);
    const slug = await this.reserveSlug(
      buildBroadcastSlug(shortName, input.opponentName, input.isHome),
    );

    const { data: event, error: eventError } = await admin
      .from("events")
      .insert({
        sport_id: team.sport_id,
        team_id: team.id,
        opponent_name: input.opponentName,
        is_home: input.isHome,
        start_time: input.startTime,
        location: input.location,
        status: "scheduled",
      })
      .select("id")
      .single();
    if (eventError || !event) {
      throw new Error(`Could not save the game: ${eventError?.message ?? "unknown error"}`);
    }

    const { data: broadcast, error: broadcastError } = await admin
      .from("broadcasts")
      .insert({
        event_id: event.id,
        title: input.title?.trim() || matchup,
        slug,
        status: "draft",
        scheduled_start: input.startTime,
      })
      .select("id")
      .single();
    if (broadcastError || !broadcast) {
      // Roll back the orphaned event so a retry starts clean.
      await admin.from("events").delete().eq("id", event.id);
      throw new Error(
        `Could not save the broadcast: ${broadcastError?.message ?? "unknown error"}`,
      );
    }

    const view = await this.getBroadcastById(broadcast.id);
    if (!view) throw new Error("The broadcast was saved but could not be read back.");
    return view;
  }

  /** Appends `-2`, `-3`, … until the slug is free. */
  private async reserveSlug(base: string): Promise<string> {
    const admin = createAdminSupabaseClient();
    for (let attempt = 1; attempt <= 25; attempt += 1) {
      const candidate = attempt === 1 ? base : `${base}-${attempt}`;
      const { data } = await admin
        .from("broadcasts")
        .select("id")
        .eq("slug", candidate)
        .maybeSingle();
      if (!data) return candidate;
    }
    return `${base}-${Date.now()}`;
  }

  async updateBroadcast(id: string, patch: BroadcastPatch): Promise<BroadcastView | null> {
    const admin = createAdminSupabaseClient();
    const { error } = await admin
      .from("broadcasts")
      .update({
        ...(patch.status !== undefined && { status: patch.status }),
        ...(patch.livekitRoomName !== undefined && { livekit_room_name: patch.livekitRoomName }),
        ...(patch.livekitIngressId !== undefined && { livekit_ingress_id: patch.livekitIngressId }),
        ...(patch.streamUrl !== undefined && { stream_url: patch.streamUrl }),
        ...(patch.startedAt !== undefined && { started_at: patch.startedAt }),
        ...(patch.endedAt !== undefined && { ended_at: patch.endedAt }),
      })
      .eq("id", id);
    if (error) {
      logQueryError("updateBroadcast", error);
      return null;
    }
    return this.getBroadcastById(id);
  }
}
