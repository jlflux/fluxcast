import "server-only";

import type { BroadcastStatus, BroadcastView } from "@/lib/types";
import { getDataSource } from "@/lib/data";
import type { BroadcastPatch } from "@/lib/data/source";
import { getIngressBroadcastStatus } from "@/lib/livekit/service";
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

/** Statuses that are settled — no point asking LiveKit again. */
const TERMINAL: readonly BroadcastStatus[] = ["ended"];

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

  let next: BroadcastStatus;
  try {
    next = await getIngressBroadcastStatus(key, broadcast.status);
  } catch (error) {
    console.error(
      `[fluxcast] Could not read LiveKit ingress ${key}:`,
      error instanceof Error ? error.message : error,
    );
    return broadcast.status;
  }

  cache().set(key, { at: Date.now(), status: next });

  if (next !== broadcast.status) {
    const patch: BroadcastPatch = { status: next };
    if (next === "live" && !broadcast.startedAt) {
      patch.startedAt = new Date().toISOString();
    }
    if (next === "ended" && !broadcast.endedAt) {
      patch.endedAt = new Date().toISOString();
    }
    await getDataSource().updateBroadcast(broadcast.id, patch);
  }

  return next;
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
