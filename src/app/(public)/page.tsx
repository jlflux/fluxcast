import { getDataSource } from "@/lib/data";
import { selectLive, selectUpcoming } from "@/lib/data/select";
import { BroadcastCard } from "@/components/public/BroadcastCard";
import { EmptyState } from "@/components/public/EmptyState";
import { SectionHeading } from "@/components/public/SectionHeading";

export default async function HomePage() {
  const broadcasts = await getDataSource().listBroadcasts();
  const live = selectLive(broadcasts);
  const upcoming = selectUpcoming(broadcasts);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <section className="border-b border-ink-800/70 pt-12 pb-9 sm:pt-16 sm:pb-12">
        <h1 className="headline text-5xl sm:text-7xl">
          <span className="text-ink-100">FLUX</span>
          <span className="text-flux-400">CAST</span>
        </h1>
        <p className="mt-4 max-w-xl text-lg text-ink-300 sm:text-xl">
          Live school sports, all in one place.
        </p>
      </section>

      <section className="py-9 sm:py-11">
        <SectionHeading accent count={live.length}>
          Live Now
        </SectionHeading>
        {live.length > 0 ? (
          <div className="flex flex-col gap-4">
            {live.map((broadcast) => (
              <BroadcastCard key={broadcast.id} broadcast={broadcast} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nothing on the air right now"
            body="When a broadcast starts, it will appear here."
          />
        )}
      </section>

      <section className="pb-4">
        <SectionHeading count={upcoming.length}>Upcoming</SectionHeading>
        {upcoming.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {upcoming.map((broadcast) => (
              <BroadcastCard key={broadcast.id} broadcast={broadcast} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No games scheduled yet"
            body="Check back soon for the upcoming broadcast schedule."
          />
        )}
      </section>
    </div>
  );
}
