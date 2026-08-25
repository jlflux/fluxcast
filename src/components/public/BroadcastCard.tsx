import Link from "next/link";

import type { BroadcastView } from "@/lib/types";
import { formatKickoff } from "@/lib/format";
import { LiveBadge } from "@/components/ui/LiveBadge";
import { SchoolCrest } from "@/components/public/SchoolCrest";

/**
 * The game card. Two treatments:
 *
 *  live     — full-width hero with a large LISTEN LIVE action
 *  upcoming — compact tile showing kickoff
 */
export function BroadcastCard({ broadcast }: { broadcast: BroadcastView }) {
  return broadcast.status === "live" ? (
    <LiveCard broadcast={broadcast} />
  ) : (
    <UpcomingCard broadcast={broadcast} />
  );
}

function LiveCard({ broadcast }: { broadcast: BroadcastView }) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-live/30 bg-gradient-to-br from-ink-850 to-ink-900 p-5 shadow-lg shadow-black/40 sm:p-7">
      <div
        className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-live/10 blur-3xl"
        aria-hidden
      />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <LiveBadge size="md" />
            <span className="eyebrow text-ink-400">{broadcast.competition}</span>
          </div>
          <div className="flex items-center gap-4">
            <SchoolCrest school={broadcast.school} size="md" />
            <h3 className="headline text-2xl text-ink-100 sm:text-4xl">
              {broadcast.matchup}
            </h3>
          </div>
          {broadcast.location && (
            <p className="mt-3 text-sm text-ink-400">{broadcast.location}</p>
          )}
        </div>

        <Link
          href={`/broadcasts/${broadcast.slug}`}
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-flux-400 px-6 py-4 text-base font-extrabold uppercase tracking-wide text-ink-950 shadow-lg shadow-flux-500/20 transition hover:bg-flux-300 sm:text-lg"
        >
          Listen Live
        </Link>
      </div>
    </article>
  );
}

function UpcomingCard({ broadcast }: { broadcast: BroadcastView }) {
  return (
    <article className="group rounded-xl border border-ink-800 bg-ink-900 transition hover:border-ink-700 hover:bg-ink-850">
      <Link
        href={`/broadcasts/${broadcast.slug}`}
        className="flex items-center gap-4 p-4 sm:p-5"
      >
        <SchoolCrest school={broadcast.school} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="eyebrow mb-1 text-flux-400">{formatKickoff(broadcast.scheduledStart)}</p>
          <h3 className="truncate text-lg font-bold tracking-tight text-ink-100">
            {broadcast.matchup}
          </h3>
          <p className="mt-0.5 truncate text-sm text-ink-400">{broadcast.competition}</p>
        </div>
        <span
          className="shrink-0 text-ink-600 transition group-hover:text-flux-400"
          aria-hidden
        >
          →
        </span>
      </Link>
    </article>
  );
}
