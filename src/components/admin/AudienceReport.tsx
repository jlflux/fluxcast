import type { ListenerStats } from "@/lib/listeners";

/**
 * The audience numbers for a broadcast.
 *
 * Labelled carefully, because a school will quote these to a booster club.
 * "Devices" is the honest word: FluxCast counts a device that pressed Listen
 * Live, and cannot know whether three people were gathered around one phone.
 */
export function AudienceReport({
  stats,
  live,
}: {
  stats: ListenerStats;
  /** Still on the air, so these numbers are still moving. */
  live: boolean;
}) {
  if (stats.uniqueListeners === 0) {
    return (
      <section className="mt-8 rounded-lg border border-ink-800 bg-ink-900 p-5">
        <h2 className="text-base font-bold tracking-tight text-ink-100">Audience</h2>
        <p className="mt-2 text-sm text-ink-400">
          {live
            ? "Nobody has pressed Listen Live yet."
            : "No one listened to this broadcast, or it finished before audience tracking was added."}
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-lg border border-ink-800 bg-ink-900 p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-base font-bold tracking-tight text-ink-100">Audience</h2>
        {live && (
          <span className="text-xs text-ink-400">still counting — the broadcast is live</span>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Peak at once" value={stats.peakConcurrent} emphasis />
        <Stat label="Devices total" value={stats.uniqueListeners} />
        <Stat label="Avg. listen" value={`${stats.averageMinutes}m`} />
        <Stat label="Longest" value={`${stats.longestMinutes}m`} />
      </dl>

      <p className="mt-4 text-xs leading-relaxed text-ink-400">
        <span className="text-ink-300">Peak at once</span> is the most devices tuned in at the
        same moment — the closest thing to &ldquo;how big was the audience&rdquo;.{" "}
        <span className="text-ink-300">Devices total</span> counts each device that pressed
        Listen Live, so one person on a phone and a laptop counts twice, and a family round one
        speaker counts once. {stats.totalMinutes.toLocaleString()} minutes were listened in
        total.
      </p>
    </section>
  );
}

function Stat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string | number;
  emphasis?: boolean;
}) {
  return (
    <div>
      <dt className="eyebrow text-ink-400">{label}</dt>
      <dd
        className={`mt-1 font-bold tracking-tight ${
          emphasis ? "text-3xl text-flux-300" : "text-3xl text-ink-100"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
