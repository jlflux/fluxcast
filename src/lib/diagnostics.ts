import "server-only";

import {
  dataMode,
  envSourceName,
  isLiveKitConfigured,
  isSupabaseConfigured,
  serverEnv,
  streamingMode,
} from "@/lib/env.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * Configuration self-check.
 *
 * Answers the question "why does this deployment say Development mode?" without
 * anyone having to read logs. It reports which environment variables the
 * *running server* can actually see, and whether the database really answers.
 *
 * It never reveals a secret's value — only whether one is present, how long it
 * is (enough to catch a truncated paste), and which variable name supplied it.
 */

export interface EnvCheck {
  label: string;
  /** Name that supplied the value, or null when nothing was found. */
  source: string | null;
  /** Names this value is read from, in priority order. */
  candidates: string[];
  present: boolean;
  /** Safe to display in full (not a credential). */
  displayValue: string | null;
  length: number;
  secret: boolean;
}

export interface TableCheck {
  table: string;
  count: number | null;
  error: string | null;
}

export interface Diagnostics {
  dataMode: "supabase" | "mock";
  streamingMode: "livekit" | "mock";
  supabaseConfigured: boolean;
  livekitConfigured: boolean;
  env: EnvCheck[];
  /** Null when Supabase is not configured, so no connection was attempted. */
  publicRead: { ok: boolean; error: string | null } | null;
  serviceRead: { ok: boolean; error: string | null } | null;
  tables: TableCheck[];
  deployment: { label: string; value: string }[];
}

/** Show a URL's host only — enough to confirm the right project, no credential. */
function safeHost(url: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return `(unparseable: ${url.slice(0, 24)}…)`;
  }
}

function check(
  label: string,
  candidates: string[],
  value: string,
  options: { secret: boolean; display?: string | null },
): EnvCheck {
  return {
    label,
    source: envSourceName(...candidates),
    candidates,
    present: value.length > 0,
    displayValue: options.secret ? null : (options.display ?? (value || null)),
    length: value.length,
    secret: options.secret,
  };
}

const SEEDED_TABLES = ["schools", "sports", "teams", "events", "broadcasts"] as const;

export async function collectDiagnostics(): Promise<Diagnostics> {
  const env: EnvCheck[] = [
    check("Supabase URL", ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"], serverEnv.supabaseUrl, {
      secret: false,
      display: safeHost(serverEnv.supabaseUrl),
    }),
    check(
      "Supabase publishable key",
      ["SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
      serverEnv.supabasePublishableKey,
      { secret: true },
    ),
    check("Supabase service role key", ["SUPABASE_SERVICE_ROLE_KEY"], serverEnv.supabaseServiceRoleKey, {
      secret: true,
    }),
    check("LiveKit URL", ["LIVEKIT_URL"], serverEnv.livekitUrl, {
      secret: false,
      display: safeHost(serverEnv.livekitUrl),
    }),
    check("LiveKit API key", ["LIVEKIT_API_KEY"], serverEnv.livekitApiKey, { secret: true }),
    check("LiveKit API secret", ["LIVEKIT_API_SECRET"], serverEnv.livekitApiSecret, {
      secret: true,
    }),
  ];

  let publicRead: Diagnostics["publicRead"] = null;
  let serviceRead: Diagnostics["serviceRead"] = null;
  const tables: TableCheck[] = [];

  if (isSupabaseConfigured) {
    // Does the publishable key + RLS actually let a fan read data?
    try {
      const supabase = await createServerSupabaseClient();
      const { error } = await supabase.from("schools").select("id").limit(1);
      publicRead = { ok: !error, error: error?.message ?? null };
    } catch (error) {
      publicRead = { ok: false, error: describe(error) };
    }

    // Does the service role key work, and did the migration + seed run?
    try {
      const admin = createAdminSupabaseClient();
      const { error } = await admin.from("schools").select("id").limit(1);
      serviceRead = { ok: !error, error: error?.message ?? null };

      for (const table of SEEDED_TABLES) {
        const { count, error: countError } = await admin
          .from(table)
          .select("*", { count: "exact", head: true });
        tables.push({
          table,
          count: countError ? null : (count ?? 0),
          error: countError?.message ?? null,
        });
      }
    } catch (error) {
      serviceRead = { ok: false, error: describe(error) };
    }
  }

  return {
    dataMode,
    streamingMode,
    supabaseConfigured: isSupabaseConfigured,
    livekitConfigured: isLiveKitConfigured,
    env,
    publicRead,
    serviceRead,
    tables,
    deployment: deploymentInfo(),
  };
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Which build is actually running. On Vercel these are injected automatically,
 * and they are the fastest way to tell whether a deployment predates a change.
 */
function deploymentInfo(): { label: string; value: string }[] {
  const entries: { label: string; value: string }[] = [
    { label: "Node environment", value: process.env.NODE_ENV ?? "unknown" },
  ];

  const vercel: [string, string | undefined][] = [
    ["Vercel environment", process.env.VERCEL_ENV],
    ["Git branch", process.env.VERCEL_GIT_COMMIT_REF],
    ["Git commit", process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)],
  ];

  for (const [label, value] of vercel) {
    if (value) entries.push({ label, value });
  }

  if (!process.env.VERCEL_ENV) {
    entries.push({ label: "Host", value: "not running on Vercel" });
  }

  return entries;
}
