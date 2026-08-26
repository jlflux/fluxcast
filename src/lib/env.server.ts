import "server-only";

/**
 * Server-only environment values.
 *
 * Importing this module from a Client Component is a build error, thanks to
 * `server-only`. That is the guardrail that keeps LIVEKIT_API_SECRET and the
 * Supabase service role key out of the browser bundle.
 *
 * WHY NO `NEXT_PUBLIC_` PREFIX ON THE SUPABASE VALUES
 *
 * Next.js replaces `process.env.NEXT_PUBLIC_*` with a literal string at BUILD
 * time, everywhere — server code included. A plain-named variable is read from
 * the environment at RUNTIME. That difference matters in two ways:
 *
 *   1. If a host withholds the variable from the build step (Vercel does this
 *      for variables typed as secrets), a `NEXT_PUBLIC_` value bakes in as an
 *      empty string and the app silently falls back to sample data in
 *      production. A runtime read just works.
 *   2. Hosting dashboards flag `NEXT_PUBLIC_` variables as browser-exposed and
 *      may refuse to store them as secrets at all.
 *
 * Nothing in FluxCast reads Supabase config in the browser today — both
 * Supabase clients are server-side. So the plain names are the correct ones.
 * The `NEXT_PUBLIC_` names are still accepted as a fallback, because some
 * hosting integrations create them for you automatically.
 *
 * When a browser Supabase client is eventually needed (the admin login form),
 * pass the URL and publishable key down from a Server Component as props
 * rather than reintroducing a build-time public variable.
 */

/**
 * First non-empty value wins.
 *
 * Values are trimmed and stripped of surrounding quotes. Pasting a value into a
 * hosting dashboard very easily picks up a trailing newline or a pair of
 * quotes, and the resulting failure ("not configured", or a 401 from Supabase)
 * gives no hint that whitespace is the cause.
 */
function envValue(...names: string[]): string {
  for (const name of names) {
    const raw = process.env[name];
    if (!raw) continue;
    const value = raw.trim().replace(/^(["'])([\s\S]*)\1$/, "$2").trim();
    if (value.length > 0) return value;
  }
  return "";
}

/** Which of the candidate names actually supplied a value. Used by diagnostics. */
export function envSourceName(...names: string[]): string | null {
  for (const name of names) {
    const raw = process.env[name];
    if (raw && raw.trim().length > 0) return name;
  }
  return null;
}

export const serverEnv = {
  supabaseUrl: envValue("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
  supabasePublishableKey: envValue(
    "SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  ),
  supabaseServiceRoleKey: envValue("SUPABASE_SERVICE_ROLE_KEY"),
  livekitUrl: envValue("LIVEKIT_URL"),
  livekitApiKey: envValue("LIVEKIT_API_KEY"),
  livekitApiSecret: envValue("LIVEKIT_API_SECRET"),
} as const;

/**
 * FluxCast reads and writes through Supabase only when all three values are
 * present. Requiring the service role key up front avoids a confusing
 * half-configured state where the public site reads real data but the admin
 * area silently fails to save.
 */
export const isSupabaseConfigured =
  serverEnv.supabaseUrl.length > 0 &&
  serverEnv.supabasePublishableKey.length > 0 &&
  serverEnv.supabaseServiceRoleKey.length > 0;

export const isLiveKitConfigured =
  serverEnv.livekitUrl.length > 0 &&
  serverEnv.livekitApiKey.length > 0 &&
  serverEnv.livekitApiSecret.length > 0;

export type DataMode = "supabase" | "mock";
export type StreamingMode = "livekit" | "mock";

export const dataMode: DataMode = isSupabaseConfigured ? "supabase" : "mock";
export const streamingMode: StreamingMode = isLiveKitConfigured ? "livekit" : "mock";

/** True when any part of the stack is running on stand-ins. */
export const isDevelopmentMode = dataMode === "mock" || streamingMode === "mock";

/**
 * The public LiveKit websocket URL that browsers connect to. This is not a
 * secret (it is a per-project hostname), but it is only ever handed to the
 * browser alongside a scoped access token, from a server route.
 */
export function getLiveKitPublicUrl(): string {
  return serverEnv.livekitUrl;
}
