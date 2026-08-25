import { notFound } from "next/navigation";

import { getDataSource } from "@/lib/data";
import { selectLive, selectUpcoming } from "@/lib/data/select";
import { BroadcastCard } from "@/components/public/BroadcastCard";
import { EmptyState } from "@/components/public/EmptyState";
import { SectionHeading } from "@/components/public/SectionHeading";
import { SchoolCrest } from "@/components/public/SchoolCrest";

export async function generateMetadata({ params }: PageProps<"/schools/[slug]">) {
  const { slug } = await params;
  const school = await getDataSource().getSchoolBySlug(slug);
  if (!school) return { title: "School not found" };
  return {
    title: `${school.shortName} ${school.mascot ?? ""}`.trim(),
    description: `Live and upcoming ${school.name} broadcasts on FluxCast.`,
  };
}

export default async function SchoolPage({ params }: PageProps<"/schools/[slug]">) {
  const { slug } = await params;
  const data = getDataSource();

  const school = await data.getSchoolBySlug(slug);
  if (!school) notFound();

  const broadcasts = await data.listBroadcasts({ schoolSlug: slug });
  const live = selectLive(broadcasts);
  const upcoming = selectUpcoming(broadcasts);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <section className="flex flex-col gap-5 border-b border-ink-800/70 py-10 sm:flex-row sm:items-center sm:gap-7 sm:py-14">
        <SchoolCrest school={school} size="lg" />
        <div>
          <h1 className="headline text-4xl sm:text-6xl">
            {school.shortName} {school.mascot}
          </h1>
          <p className="mt-2 text-base text-ink-300 sm:text-lg">
            {[school.city, school.state].filter(Boolean).join(", ")}
          </p>
        </div>
      </section>

      <section className="py-10">
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
            title="No live broadcast"
            body={`${school.shortName} is not on the air right now.`}
          />
        )}
      </section>

      <section>
        <SectionHeading count={upcoming.length}>Upcoming Broadcasts</SectionHeading>
        {upcoming.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {upcoming.map((broadcast) => (
              <BroadcastCard key={broadcast.id} broadcast={broadcast} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No games scheduled"
            body={`Upcoming ${school.shortName} broadcasts will show up here.`}
          />
        )}
      </section>
    </div>
  );
}
