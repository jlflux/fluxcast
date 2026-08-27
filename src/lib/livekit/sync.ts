import "server-only";

import type { BroadcastStatus, BroadcastView } from "@/lib/types";
import { getDataSource } from "@/lib/data";
import type { BroadcastPatch } from "@/lib/data/source";
import { getIngressSignal } from "@/lib/livekit/service";
import type { IngressSignal } from "@/lib/livekit/status";
import { isLiveKitConfigured } from "@/lib/env.server";

/**
 * Keeping broadcast status in sync with LiveKit.
 *
 * DESIGN DECISION: polling, not webhooks.
 *
 * LiveKit's ingress API already exposes exactly the state machine FluxCast
 * wants (inactive / buffering / publishing / error / complete), so a poll is a
 * single API call with a direct mapping. Webhooks would need a publicly
 * reachable HTTPS endpoint plus signature verification, which means a tunnel
 * before you can test anything locally — real infrastructure for no extra
 * information. If FluxCast ever needs sub-second status or has hundreds of
 * concurrent broadcasts, webhooks become worth it; a single school does not
 * need them. See README, "Stream status".
 */

/** Don't ask LiveKit about the same ingress more than once per interval. */
const THROTTLE_MS = 5_000;

const globalForCache = globalThis as typeof globalThis & {
  __fluxcastStatusCache?: Map<string, { at: number; status: BroadcastStatus }>;
};

function cache(): Map<string, { at: number; status: BroadcastStatus }> {
  globalForCache.__fluxcastStatusCache ??= new Map();
  return globalForCache.__fluxcastStatusCache;
}

/**
 * Statuses that are settled — no point asking LiveKit again.
 *
 * A broadcast only reaches `ended` because an admin ended it, or because an
 * interruption outlasted the grace period. Losing the encoder no longer lands
 * here, which is what lets a dropped stream come back.
 */
const TERMINAL: readonly BroadcastStatus[] = ["ended"];

/**
 * How long a broadcast may sit without an encoder before it is called over.
 *
 * Long enough to survive a router reboot, a van moving, or an operator
 * restarting OBS at halftime. Short enough that a broadcast someone simply
 * walked away from does not sit on the homepage saying "reconnecting" all
 * night.
 */
const INTERRUPTION_GRACE_MS = 30 * 60 * 1000;

/**
 * Read the live status of a broadcast from LiveKit and persist any change.
 *
 * Returns the current status. Safe to call on every poll: it throttles, skips
 * broadcasts with no ingress, and never throws — a LiveKit hiccup should not
 * blank out the page, so the last known status is returned instead.
 */
export async function syncBroadcastStatus(
  broadcast: BroadcastView,
): Promise<BroadcastStatus> {
  if (!isLiveKitConfigured) return broadcast.status;
  if (!broadcast.livekitIngressId) return broadcast.status;
  if (TERMINAL.includes(broadcast.status)) return broadcast.status;

  const key = broadcast.livekitIngressId;
  const cached = cache().get(key);
  if (cached && Date.now() - cached.at < THROTTLE_MS) return cached.status;

  let signal;
  try {
    signal = await getIngressSignal(key);
  } catch (error) {
    console.error(
      `[fluxcast] Could not read LiveKit ingress ${key}:`,
      error instanceof Error ? error.message : error,
    );
    return broadcast.status;
  }

  const { status: next, patch } = decideStatus(broadcast, signal);

  cache().set(key, { at: Date.now(), status: next });

  if (next !== broadcast.status || Object.keys(patch).length > 0) {
    await getDataSource().updateBroadcast(broadcast.id, { status: next, ...patch });
  }

  return next;
}

/**
 * The interruption state machine.
 *
 * Split out from the I/O so it can be reasoned about — and tested — on its own.
 */
export function decideStatus(
  broadcast: Pick<BroadcastView, "status" | "startedAt" | "endedAt" | "interruptedAt">,
  signal: IngressSignal,
  now: number = Date.now(),
): { status: BroadcastStatus; patch: BroadcastPatch } {
  const nowIso = new Date(now).toISOString();

  switch (signal) {
    case "publishing": {
      // Audio is flowing. Clear any interruption; this is also the path a
      // reconnected stream takes back to live.
      const patch: BroadcastPatch = { interruptedAt: null, endedAt: null };
      if (!broadcast.startedAt) patch.startedAt = nowIso;
      return { status: "live", patch };
    }

    case "buffering":
      return { status: "connected", patch: { interruptedAt: null, endedAt: null } };

    case "error":
      return { status: "error", patch: {} };

    case "encoder-gone": {
      // Never started: the ingress is simply waiting for its first connection.
      if (!broadcast.startedAt) {
        return { status: "ready", patch: {} };
      }

      // Was live and the encoder has just gone. Start the grace clock.
      if (!broadcast.interruptedAt) {
        return { status: "ready", patch: { interruptedAt: nowIso } };
      }

      // Still gone. End it only once the grace period has run out.
      const goneFor = now - Date.parse(broadcast.interruptedAt);
      if (goneFor >= INTERRUPTION_GRACE_MS) {
        return { status: "ended", patch: { endedAt: nowIso } };
      }
      return { status: "ready", patch: {} };
    }

    default:
      return { status: broadcast.status, patch: {} };
  }
}

/** Sync a batch of broadcasts, e.g. for the admin dashboard. */
export async function syncBroadcastStatuses(
  broadcasts: BroadcastView[],
): Promise<BroadcastView[]> {
  return Promise.all(
    broadcasts.map(async (broadcast) => ({
      ...broadcast,
      status: await syncBroadcastStatus(broadcast),
    })),
  );
}
