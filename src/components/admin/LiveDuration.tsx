"use client";

import { useEffect, useState } from "react";

/**
 * How long a broadcast has been on the air, counting up.
 *
 * LiveKit bills ingress by the minute, so an encoder left running is a bill
 * accruing quietly. A broadcast live far longer than any game lasts is almost
 * always one somebody forgot to stop — this makes that obvious at a glance
 * rather than at the end of the billing period.
 *
 * A client component on purpose: elapsed time depends on the current clock,
 * which is not something a component may read during render. Here it is state,
 * updated on an interval.
 */

/** Past this, a live broadcast is more likely forgotten than genuinely running. */
const SUSPICIOUS_MS = 5 * 60 * 60 * 1000;
const TICK_MS = 30_000;

function format(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60_000);
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

export function LiveDuration({
  startedAt,
  endedAt,
  showWarning = false,
}: {
  startedAt: string | null;
  endedAt: string | null;
  showWarning?: boolean;
}) {
  const active = Boolean(startedAt) && !endedAt;
  const [elapsed, setElapsed] = useState<number | null>(null);

  useEffect(() => {
    if (!active || !startedAt) return;
    const started = Date.parse(startedAt);
    const timer = setInterval(() => setElapsed(Date.now() - started), TICK_MS);
    // Fire once immediately without setting state during the effect body.
    const first = setTimeout(() => setElapsed(Date.now() - started), 0);
    return () => {
      clearInterval(timer);
      clearTimeout(first);
    };
  }, [active, startedAt]);

  // Renders nothing on the server, so hydration markup matches.
  if (!active || elapsed === null) return null;

  const long = elapsed > SUSPICIOUS_MS;
  const label = format(elapsed);

  if (!showWarning) {
    return (
      <span className={long ? "text-xs text-amber-300" : "text-xs text-ink-400"}>
        on air {label}
      </span>
    );
  }

  return (
    <div className="mt-4">
      <p className={long ? "text-sm text-amber-200" : "text-sm text-ink-300"}>
        On air for <span className="font-semibold">{label}</span>
      </p>
      {long && (
        <p className="mt-1 rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
          That is longer than any game. LiveKit bills ingress by the minute for as long as the
          encoder stays connected, so if this was left running, stop the encoder and press End
          broadcast.
        </p>
      )}
    </div>
  );
}
