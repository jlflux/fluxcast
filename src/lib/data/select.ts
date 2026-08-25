import type { BroadcastView } from "@/lib/types";
import { isToday } from "@/lib/format";

/**
 * Pure selectors over a list of broadcasts.
 *
 * Filtering lives here rather than in each DataSource so the mock and Supabase
 * implementations can never disagree about what "upcoming" means.
 */

/** How long after kickoff a broadcast that never went live still counts as upcoming. */
const STALE_AFTER_MS = 4 * 60 * 60 * 1000;

const byStartAsc = (a: BroadcastView, b: BroadcastView) =>
  Date.parse(a.scheduledStart) - Date.parse(b.scheduledStart);

const byStartDesc = (a: BroadcastView, b: BroadcastView) =>
  Date.parse(b.scheduledStart) - Date.parse(a.scheduledStart);

/** Audio is flowing right now. */
export function selectLive(broadcasts: BroadcastView[]): BroadcastView[] {
  return broadcasts.filter((b) => b.status === "live").sort(byStartAsc);
}

/** Scheduled but not yet on the air, and not so far past kickoff that it is stale. */
export function selectUpcoming(
  broadcasts: BroadcastView[],
  now: Date = new Date(),
): BroadcastView[] {
  const cutoff = now.getTime() - STALE_AFTER_MS;
  return broadcasts
    .filter(
      (b) =>
        (b.status === "draft" || b.status === "ready" || b.status === "connected") &&
        Date.parse(b.scheduledStart) >= cutoff,
    )
    .sort(byStartAsc);
}

/** Anything scheduled for today, whatever its state. Used by the admin dashboard. */
export function selectToday(
  broadcasts: BroadcastView[],
  now: Date = new Date(),
): BroadcastView[] {
  return broadcasts.filter((b) => isToday(b.scheduledStart, now)).sort(byStartAsc);
}

/** Finished or failed, most recent first. */
export function selectPast(broadcasts: BroadcastView[]): BroadcastView[] {
  return broadcasts
    .filter((b) => b.status === "ended" || b.status === "error")
    .sort(byStartDesc);
}
