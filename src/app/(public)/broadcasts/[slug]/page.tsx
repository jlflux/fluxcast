import Link from "next/link";
import { notFound } from "next/navigation";

import { getDataSource } from "@/lib/data";
import { isInterrupted } from "@/lib/types";
import { syncBroadcastStatus } from "@/lib/livekit/sync";
import { formatLongDay, formatTime } from "@/lib/format";
import { LiveBadge } from "@/components/ui/LiveBadge";
import { SchoolCrest } from "@/components/public/SchoolCrest";
import { ListenLivePlayer } from "@/components/player/ListenLivePlayer";
import { BroadcastStatusWatcher } from "@/components/player/BroadcastStatusWatcher";

export async function generateMetadata({ params }: PageProps<"/broadcasts/[slug]">) {
  const { slug } = await params;
  const broadcast = await getDataSource().getBroadcastBySlug(slug);
  if (!broadcast) return { title: "Broadcast not found" };
  return {
    title: broadcast.matchup,
    description: `${broadcast.competition} — listen live on FluxCast.`,
  };
}

export default async function BroadcastPage({ params }: PageProps<"/broadcasts/[slug]">) {
  const { slug } = await params;

  const broadcast = await getDataSource().getBroadcastBySlug(slug);
  if (!broadcast) notFound();

  // Ask LiveKit whether audio is actually flowing before deciding what to show.
  const status = await syncBroadcastStatus(broadcast);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
      <BroadcastStatusWatcher slug={slug} status={status} />

      <nav className="pt-6">
        <Link
          href={`/schools/${broadcast.school.slug}`}
          className="text-sm text-ink-400 transition hover:text-ink-200"
        >
          ← {broadcast.school.shortName} {broadcast.school.mascot}
        </Link>
      </nav>

      <header className="py-8 sm:py-10">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {status === "live" ? (
            <LiveBadge size="lg" />
          ) : (
            <span className="eyebrow text-flux-400">{broadcast.competition}</span>
          )}
          {status === "live" && (
            <span className="eyebrow text-ink-400">{broadcast.competition}</span>
          )}
        </div>

        <div className="flex items-start gap-4 sm:gap-5">
          <SchoolCrest school={broadcast.school} size="md" />
          <div className="min-w-0">
            <h1 className="headline text-3xl sm:text-5xl">{broadcast.matchup}</h1>
            <p className="mt-3 text-base text-ink-300">
              {formatLongDay(broadcast.scheduledStart)} · {formatTime(broadcast.scheduledStart)}
            </p>
            {broadcast.location && (
              <p className="mt-1 text-sm text-ink-400">{broadcast.location}</p>
            )}
          </div>
        </div>
      </header>

      <BroadcastState
        status={status}
        interrupted={isInterrupted({ ...broadcast, status })}
        slug={slug}
        scheduledStart={broadcast.scheduledStart}
        matchup={broadcast.matchup}
        competition={broadcast.competition}
        schoolName={`${broadcast.school.shortName} ${broadcast.school.mascot ?? ""}`.trim()}
      />
    </div>
  );
}

function BroadcastState({
  status,
  interrupted,
  slug,
  scheduledStart,
  matchup,
  competition,
  schoolName,
}: {
  status: import("@/lib/types").BroadcastStatus;
  interrupted: boolean;
  slug: string;
  scheduledStart: string;
  matchup: string;
  competition: string;
  schoolName: string;
}) {
  // Mid-dropout the player stays mounted, so an existing listener keeps their
  // LiveKit connection and resumes automatically when the feed returns.
  if (status === "live" || interrupted) {
    return (
      <>
        <ListenLivePlayer
          slug={slug}
          initialStatus={status}
          interrupted={interrupted}
          matchup={matchup}
          competition={competition}
          schoolName={schoolName}
        />
        {interrupted && (
          <p className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-100/90">
            The feed from the booth dropped out. This page reconnects on its own as soon as
            it&rsquo;s back — no need to refresh.
          </p>
        )}
      </>
    );
  }

  if (status === "ended") {
    return (
      <Panel title="This broadcast has ended.">
        Thanks for listening. Check the schedule for the next game.
      </Panel>
    );
  }

  if (status === "error") {
    return (
      <Panel title="This broadcast is having technical difficulties.">
        The broadcast team is working on it. Try again in a few minutes.
      </Panel>
    );
  }

  if (status === "connected") {
    return (
      <Panel title="The broadcast is about to begin.">
        We&rsquo;re connected to the booth. Audio will start shortly — this page updates on its own.
      </Panel>
    );
  }

  return (
    <Panel title={`Broadcast begins at ${formatTime(scheduledStart)}.`}>
      Come back at kickoff, or leave this page open — it will go live on its own.
    </Panel>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-ink-800 bg-ink-900 p-6 text-center sm:p-8">
      <p className="text-lg font-bold tracking-tight text-ink-100 sm:text-xl">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-400">{children}</p>
    </div>
  );
}
