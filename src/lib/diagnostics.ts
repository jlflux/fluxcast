import "server-only";

import {
  dataMode,
  envSourceName,
  isLiveKitConfigured,
  isSupabaseConfigured,
  rawSupabaseUrl,
  serverEnv,
  streamingMode,
} from "@/lib/env.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { listAllIngresses } from "@/lib/livekit/service";

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

export interface ConnResult {
  ok: boolean;
  /** Human-readable failure reason, with the underlying cause unwrapped. */
  error: string | null;
  /** PostgREST error code (e.g. 42P01 = table does not exist), when present. */
  code: string | null;
  /** PostgREST hint/details, when present. */
  detail: string | null;
}

/** A schema feature a migration is responsible for. */
export interface MigrationCheck {
  migration: string;
  what: string;
  present: boolean;
  detail: string | null;
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
  /**
   * Reachability of the Supabase REST endpoint. When the queries below
   * succeeded, this is inferred from them rather than probed — a successful
   * query is stronger evidence than any probe.
   */
  reachability: {
    ok: boolean;
    status: number | null;
    error: string | null;
    inferred: boolean;
  } | null;
  /** Null when Supabase is not configured, so no connection was attempted. */
  publicRead: ConnResult | null;
  serviceRead: ConnResult | null;
  /** Problems spotted in the *shape* of a configured value. */
  warnings: string[];
  /** Set when the configured Supabase URL was trimmed to its origin. */
  urlNormalisedFrom: string | null;
  tables: TableCheck[];
  migrations: MigrationCheck[];
  /** LiveKit ingresses currently held, and whether FluxCast still tracks each. */
  livekit: {
    ok: boolean;
    error: string | null;
    ingresses: { ingressId: string; name: string; roomName: string; tracked: boolean }[];
  } | null;
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

/**
 * Probe the schema features later migrations add.
 *
 * Running the app against a database that is missing one of these fails in
 * confusing ways — a missing column makes every broadcast query error, so the
 * site simply looks empty. Naming the migration turns that into a one-minute
 * fix.
 */
async function checkMigrations(): Promise<MigrationCheck[]> {
  const admin = createAdminSupabaseClient();

  const probes: { migration: string; what: string; run: () => Promise<string | null> }[] = [
    {
      migration: "0002_auth_and_roles.sql",
      what: "profiles table (admin accounts and roles)",
      run: async () => {
        const { error } = await admin.from("profiles").select("id").limit(1);
        return error?.message ?? null;
      },
    },
    {
      migration: "0003_broadcast_interruptions.sql",
      what: "broadcasts.interrupted_at (surviving a dropped stream)",
      run: async () => {
        const { error } = await admin.from("broadcasts").select("interrupted_at").limit(1);
        return error?.message ?? null;
      },
    },
    {
      migration: "0004_listener_sessions.sql",
      what: "listener_sessions table (audience numbers)",
      run: async () => {
        const { error } = await admin.from("listener_sessions").select("id").limit(1);
        return error?.message ?? null;
      },
    },
  ];

  return Promise.all(
    probes.map(async ({ migration, what, run }) => {
      try {
        const failure = await run();
        return { migration, what, present: failure === null, detail: failure };
      } catch (error) {
        return { migration, what, present: false, detail: describe(error) };
      }
    }),
  );
}

/**
 * List the LiveKit ingresses this project holds.
 *
 * Doubles as a credentials check: the call is only possible with a working
 * key and secret, so a failure here explains a "could not create the stream
 * destination" before anyone hits it.
 */
async function checkLiveKit(): Promise<Diagnostics["livekit"]> {
  if (!isLiveKitConfigured) return null;
  try {
    const ingresses = await listAllIngresses();

    // Which of them does FluxCast still have a broadcast for? Anything else is
    // occupying a slot for nothing.
    let tracked = new Set<string>();
    if (isSupabaseConfigured) {
      const admin = createAdminSupabaseClient();
      const { data } = await admin
        .from("broadcasts")
        .select("livekit_ingress_id")
        .not("livekit_ingress_id", "is", null);
      tracked = new Set(
        (data ?? [])
          .map((row) => row.livekit_ingress_id)
          .filter((id): id is string => typeof id === "string"),
      );
    }

    return {
      ok: true,
      error: null,
      ingresses: ingresses.map((i) => ({ ...i, tracked: tracked.has(i.ingressId) })),
    };
  } catch (error) {
    return { ok: false, error: describe(error), ingresses: [] };
  }
}

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

  let publicRead: ConnResult | null = null;
  let serviceRead: ConnResult | null = null;
  const tables: TableCheck[] = [];
  let migrations: MigrationCheck[] = [];
  if (isSupabaseConfigured) {
    // Does the publishable key + RLS actually let a fan read data?
    try {
      const supabase = await createServerSupabaseClient();
      const { error } = await supabase.from("schools").select("id").limit(1);
      publicRead = connResult(error);
    } catch (error) {
      publicRead = connResult(error);
    }

    // Does the service role key work, and did the migration + seed run?
    try {
      const admin = createAdminSupabaseClient();
      const { error } = await admin.from("schools").select("id").limit(1);
      serviceRead = connResult(error);

      migrations = await checkMigrations();

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
      serviceRead = connResult(error);
    }
  }

  /**
   * A successful query proves the endpoint is reachable, so only probe when
   * something failed and needs explaining. Probing unconditionally let a
   * quirk of the probe contradict two queries that had plainly worked.
   */
  const readsSucceeded = publicRead?.ok === true && serviceRead?.ok === true;
  const reachability: Diagnostics["reachability"] = !isSupabaseConfigured
    ? null
    : readsSucceeded
      ? { ok: true, status: null, error: null, inferred: true }
      : await checkReachability();

  return {
    dataMode,
    streamingMode,
    supabaseConfigured: isSupabaseConfigured,
    livekitConfigured: isLiveKitConfigured,
    env,
    reachability,
    publicRead,
    serviceRead,
    migrations,
    livekit: await checkLiveKit(),
    warnings: configWarnings(),
    urlNormalisedFrom:
      rawSupabaseUrl && rawSupabaseUrl.trim() !== serverEnv.supabaseUrl
        ? rawSupabaseUrl.trim()
        : null,
    tables,
    deployment: deploymentInfo(),
  };
}

/**
 * Unwrap an error into something actionable.
 *
 * Node's fetch reports every network failure as the useless "TypeError: fetch
 * failed" and puts the real reason (ENOTFOUND, ECONNREFUSED, certificate
 * problems) on `cause`. Walking the chain is the difference between a user
 * seeing "fetch failed" and seeing "getaddrinfo ENOTFOUND".
 */
function describe(error: unknown): string {
  if (error === null || error === undefined) return "unknown error";
  if (typeof error === "string") return error;
  if (!(error instanceof Error)) {
    const record = error as { message?: unknown };
    return typeof record.message === "string" ? record.message : String(error);
  }

  const parts: string[] = [error.message];
  let cause: unknown = (error as { cause?: unknown }).cause;

  for (let depth = 0; cause && depth < 4; depth += 1) {
    if (cause instanceof Error) {
      const code = (cause as { code?: string }).code;
      parts.push(code ? `${cause.message} (${code})` : cause.message);
      cause = (cause as { cause?: unknown }).cause;
    } else {
      parts.push(String(cause));
      break;
    }
  }

  return parts.join(" — ");
}

/**
 * Strip stack frames and cap length.
 *
 * On a network failure supabase-js puts an entire JS stack trace in `details`,
 * which buries the one useful line under noise nobody can act on.
 */
function tidyDetail(value: string | undefined): string | null {
  if (!value) return null;
  const meaningful = value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("at ") && !line.startsWith("Caused by"))
    .join(" · ");
  if (!meaningful) return null;
  return meaningful.length > 240 ? `${meaningful.slice(0, 240)}…` : meaningful;
}

/** Normalise a supabase-js error object into a ConnResult. */
function connResult(error: unknown): ConnResult {
  if (!error) return { ok: true, error: null, code: null, detail: null };
  const record = error as { code?: string; details?: string; hint?: string };
  const detail = [tidyDetail(record.details), tidyDetail(record.hint)]
    .filter(Boolean)
    .join(" · ");
  return {
    ok: false,
    error: describe(error),
    code: record.code ?? null,
    detail: detail || null,
  };
}

/**
 * Sanity-check the *shape* of configured values.
 *
 * The most common Supabase setup mistake is pasting the dashboard URL rather
 * than the API URL, which fails with a network error that says nothing about
 * the real cause.
 */
function configWarnings(): string[] {
  const warnings: string[] = [];
  const url = serverEnv.supabaseUrl;

  if (url) {
    let host: string | null = null;
    try {
      const parsed = new URL(url);
      host = parsed.host;
      if (parsed.pathname !== "/" && parsed.pathname !== "") {
        warnings.push(
          `The Supabase URL still has a path ("${parsed.pathname}") after normalisation. It should be just the origin, e.g. https://your-project.supabase.co`,
        );
      }
      if (parsed.protocol !== "https:") {
        warnings.push(`The Supabase URL should start with https://, not ${parsed.protocol}`);
      }
    } catch {
      warnings.push(`The Supabase URL is not a valid URL: "${url.slice(0, 40)}"`);
    }

    if (host === "supabase.com" || host === "www.supabase.com" || host === "app.supabase.com") {
      warnings.push(
        "That is the Supabase dashboard URL, not the API URL. Use Project Settings -> Data API -> Project URL, which looks like https://your-project.supabase.co",
      );
    } else if (host && !host.endsWith(".supabase.co") && !host.includes("localhost")) {
      warnings.push(
        `Unexpected Supabase host "${host}". The API URL normally ends in .supabase.co`,
      );
    }

    if (url.startsWith("postgres")) {
      warnings.push(
        "That is the Postgres connection string, not the API URL. FluxCast talks to Supabase over HTTPS.",
      );
    }
  }

  const publishable = serverEnv.supabasePublishableKey;
  if (publishable && !publishable.startsWith("sb_publishable_") && !publishable.startsWith("ey")) {
    warnings.push(
      "The publishable key does not look like a Supabase key (expected it to start with sb_publishable_ or ey).",
    );
  }
  if (publishable.startsWith("sb_secret_")) {
    warnings.push(
      "The publishable key slot holds a SECRET key. Swap it for the publishable key.",
    );
  }

  const service = serverEnv.supabaseServiceRoleKey;
  if (service && service.startsWith("sb_publishable_")) {
    warnings.push(
      "The service role key slot holds the PUBLISHABLE key. Admin writes will fail until this is the secret key.",
    );
  }

  return warnings;
}

/**
 * Can we reach the Supabase REST endpoint at all?
 *
 * Separates "the network/URL is wrong" from "the credentials are wrong":
 * a thrown error means DNS or TLS trouble, 401 means a bad key, 404 means the
 * wrong project or path, and 200 means the endpoint is healthy.
 */
async function checkReachability(): Promise<Diagnostics["reachability"]> {
  if (!serverEnv.supabaseUrl) return null;
  try {
    const response = await fetch(`${serverEnv.supabaseUrl.replace(/\/$/, "")}/rest/v1/`, {
      headers: {
        // Supabase wants both. Sending only `apikey` gets a 401 from the
        // PostgREST root even when the key is perfectly valid.
        apikey: serverEnv.supabasePublishableKey,
        Authorization: `Bearer ${serverEnv.supabasePublishableKey}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    return { ok: response.ok, status: response.status, error: null, inferred: false };
  } catch (error) {
    return { ok: false, status: null, error: describe(error), inferred: false };
  }
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
