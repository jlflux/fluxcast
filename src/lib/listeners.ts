/**
 * Listener numbers for a finished (or running) broadcast.
 *
 * What these are, precisely — schools will quote them, so the labels matter:
 *
 *   uniqueListeners  devices that pressed Listen Live, not people. One person
 *                    on a phone and a laptop counts twice; a shared car radio
 *                    counts once.
 *   peakConcurrent   the most that were listening at the same moment. This is
 *                    the number closest to "how big was the audience".
 *   totalMinutes     summed listening time across everyone.
 *
 * Deliberately not tracked: who anyone is. Fans have no accounts, and FluxCast
 * stores an opaque random key per device, nothing else.
 */

export interface ListenerSessionWindow {
  firstSeen: string;
  lastSeen: string;
}

export interface ListenerStats {
  uniqueListeners: number;
  peakConcurrent: number;
  totalMinutes: number;
  averageMinutes: number;
  /** Longest single session, in minutes. */
  longestMinutes: number;
}

export const EMPTY_LISTENER_STATS: ListenerStats = {
  uniqueListeners: 0,
  peakConcurrent: 0,
  totalMinutes: 0,
  averageMinutes: 0,
  longestMinutes: 0,
};

/**
 * A device that reported in is presumed listening until its next heartbeat was
 * due. Without this, someone who tuned in and was only seen once has a
 * zero-length window and contributes nothing to peak concurrency — so three
 * people joining seconds apart could report a peak of two.
 */
const MIN_SESSION_MS = 30_000;

/**
 * Peak concurrency by sweep line: walk every start and end in time order,
 * +1 on a start, -1 on an end, and remember the high-water mark. Ties are
 * ordered starts-before-ends so two sessions that touch at the same instant
 * count as overlapping rather than being missed.
 */
export function computeListenerStats(sessions: ListenerSessionWindow[]): ListenerStats {
  if (sessions.length === 0) return EMPTY_LISTENER_STATS;

  const events: { at: number; delta: number }[] = [];
  let totalMs = 0;
  let longestMs = 0;

  for (const session of sessions) {
    const start = Date.parse(session.firstSeen);
    const seen = Date.parse(session.lastSeen);
    if (Number.isNaN(start) || Number.isNaN(seen)) continue;
    const end = Math.max(seen, start + MIN_SESSION_MS);
    const duration = end - start;
    totalMs += duration;
    longestMs = Math.max(longestMs, duration);
    events.push({ at: start, delta: 1 }, { at: end, delta: -1 });
  }

  events.sort((a, b) => (a.at === b.at ? b.delta - a.delta : a.at - b.at));

  let running = 0;
  let peak = 0;
  for (const event of events) {
    running += event.delta;
    if (running > peak) peak = running;
  }

  const minutes = (ms: number) => Math.round(ms / 60_000);

  return {
    uniqueListeners: sessions.length,
    peakConcurrent: peak,
    totalMinutes: minutes(totalMs),
    averageMinutes: minutes(totalMs / sessions.length),
    longestMinutes: minutes(longestMs),
  };
}
