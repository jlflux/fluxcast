/**
 * Hand-written database types matching `supabase/migrations/0001_init.sql`.
 *
 * These are declared with `type` rather than `interface` on purpose: supabase-js
 * constrains a schema's rows to `Record<string, unknown>`, and only type aliases
 * get an implicit index signature. An interface here silently collapses the
 * whole schema to `never` and every query loses its types.
 *
 * Once you have a Supabase project you can replace this file with generated
 * types (`npx supabase gen types typescript --linked > src/lib/supabase/types.ts`);
 * the shape below is deliberately the same as what the generator produces, so
 * nothing else has to change.
 */

export type SchoolRow = {
  id: string;
  name: string;
  slug: string;
  short_name: string;
  mascot: string | null;
  city: string | null;
  state: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  active: boolean;
  created_at: string;
}

export type SportRow = {
  id: string;
  name: string;
  slug: string;
}

export type TeamRow = {
  id: string;
  school_id: string;
  sport_id: string;
  level: string;
  gender: string | null;
  created_at: string;
}

export type EventRow = {
  id: string;
  sport_id: string;
  team_id: string;
  opponent_name: string;
  is_home: boolean;
  start_time: string;
  location: string | null;
  status: string;
  created_at: string;
}

export type BroadcastRow = {
  id: string;
  event_id: string;
  title: string;
  slug: string;
  status: string;
  livekit_room_name: string | null;
  livekit_ingress_id: string | null;
  stream_url: string | null;
  scheduled_start: string;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

export type BroadcastInsert = {
  event_id: string;
  title: string;
  slug: string;
  status: string;
  scheduled_start: string;
  livekit_room_name?: string | null;
  livekit_ingress_id?: string | null;
  stream_url?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
}

type Table<Row, Insert> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Insert>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      schools: Table<SchoolRow, Omit<SchoolRow, "id" | "created_at" | "active"> & { active?: boolean }>;
      sports: Table<SportRow, Omit<SportRow, "id">>;
      teams: Table<TeamRow, Omit<TeamRow, "id" | "created_at">>;
      events: Table<EventRow, Omit<EventRow, "id" | "created_at">>;
      broadcasts: Table<BroadcastRow, BroadcastInsert>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
