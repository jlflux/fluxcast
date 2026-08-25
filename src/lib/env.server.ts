import "server-only";

import { hasPublicSupabaseConfig, publicEnv } from "@/lib/env";

/**
 * Server-only environment values.
 *
 * Importing this module from a Client Component is a build error, thanks to
 * `server-only`. That is the guardrail that keeps LIVEKIT_API_SECRET and the
 * Supabase service role key out of the browser bundle.
 */

export const serverEnv = {
  supabaseUrl: publicEnv.supabaseUrl,
  supabasePublishableKey: publicEnv.supabasePublishableKey,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  livekitUrl: process.env.LIVEKIT_URL ?? "",
  livekitApiKey: process.env.LIVEKIT_API_KEY ?? "",
  livekitApiSecret: process.env.LIVEKIT_API_SECRET ?? "",
} as const;

/**
 * FluxCast reads and writes through Supabase only when all three values are
 * present. Requiring the service role key up front avoids a confusing
 * half-configured state where the public site reads real data but the admin
 * area silently fails to save.
 */
export const isSupabaseConfigured =
  hasPublicSupabaseConfig && serverEnv.supabaseServiceRoleKey.length > 0;

export const isLiveKitConfigured =
  serverEnv.livekitUrl.length > 0 &&
  serverEnv.livekitApiKey.length > 0 &&
  serverEnv.livekitApiSecret.length > 0;

export type DataMode = "supabase" | "mock";
export type StreamingMode = "livekit" | "mock";

export const dataMode: DataMode = isSupabaseConfigured ? "supabase" : "mock";
export const streamingMode: StreamingMode = isLiveKitConfigured ? "livekit" : "mock";

/** True when any part of the stack is running on stand-in data. */
export const isDevelopmentMode = dataMode === "mock" || streamingMode === "mock";

/**
 * The public LiveKit websocket URL that browsers connect to. This is not a
 * secret (it is a per-project hostname), but it is only ever handed to the
 * browser alongside a scoped access token, from a server route.
 */
export function getLiveKitPublicUrl(): string {
  return serverEnv.livekitUrl;
}
