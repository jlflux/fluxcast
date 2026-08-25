/**
 * Public environment values.
 *
 * Only `NEXT_PUBLIC_*` variables belong here — everything in this file may be
 * inlined into the browser bundle. Secrets live in `env.server.ts`.
 *
 * Note: `process.env.NEXT_PUBLIC_*` must be referenced as a literal member
 * expression for Next.js to statically replace it at build time.
 */

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
} as const;

/** True when the browser has enough configuration to talk to Supabase. */
export const hasPublicSupabaseConfig =
  publicEnv.supabaseUrl.length > 0 && publicEnv.supabasePublishableKey.length > 0;
