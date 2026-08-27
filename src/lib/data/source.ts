import type {
  BroadcastStatus,
  BroadcastView,
  CreateBroadcastInput,
  CreateSchoolInput,
  CreateTeamInput,
  School,
  Sport,
  UpdateBroadcastInput,
} from "@/lib/types";

/** A team, flattened for the admin form's dropdown. */
export interface TeamOption {
  id: string;
  schoolId: string;
  schoolName: string;
  schoolShortName: string;
  sportId: string;
  sportName: string;
  level: string;
  /** "Homewood Varsity Football" */
  label: string;
}

/** Fields the app updates on a broadcast after creation. */
export interface BroadcastPatch {
  status?: BroadcastStatus;
  livekitRoomName?: string | null;
  livekitIngressId?: string | null;
  streamUrl?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  interruptedAt?: string | null;
}

/**
 * The one seam between FluxCast and its storage.
 *
 * Two implementations exist: `mock` (in-memory fixtures, used when Supabase is
 * not configured) and `supabase` (real Postgres). Every page and action talks
 * to this interface, which is what lets the whole UI render before any
 * credentials exist.
 */
export interface DataSource {
  readonly mode: "mock" | "supabase";

  listSchools(): Promise<School[]>;
  getSchoolBySlug(slug: string): Promise<School | null>;
  listSports(): Promise<Sport[]>;
  listTeamOptions(): Promise<TeamOption[]>;

  /** All broadcasts, newest scheduled first is *not* guaranteed — callers sort. */
  listBroadcasts(options?: { schoolSlug?: string }): Promise<BroadcastView[]>;
  getBroadcastBySlug(slug: string): Promise<BroadcastView | null>;
  getBroadcastById(id: string): Promise<BroadcastView | null>;

  createBroadcast(input: CreateBroadcastInput): Promise<BroadcastView>;
  updateBroadcast(id: string, patch: BroadcastPatch): Promise<BroadcastView | null>;

  /** Correct the details of an existing broadcast and its event. */
  updateBroadcastDetails(
    id: string,
    input: UpdateBroadcastInput,
  ): Promise<BroadcastView | null>;

  createSchool(input: CreateSchoolInput): Promise<School>;
  createTeam(input: CreateTeamInput): Promise<TeamOption>;
}
