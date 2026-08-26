import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { canManageSchool, requireAdmin } from "@/lib/auth";
import { getDataSource } from "@/lib/data";
import { syncBroadcastStatus } from "@/lib/livekit/sync";
import { getStreamCredentials } from "@/lib/livekit/service";
import { streamingMode } from "@/lib/env.server";
import { formatKickoff } from "@/lib/format";
import { STATUS_HINT } from "@/lib/livekit/status";
import { StatusPill } from "@/components/ui/StatusPill";
import { StreamDestination } from "@/components/admin/StreamDestination";
import { AdminRefresher } from "@/components/admin/AdminRefresher";
import {
  generateStreamDestinationAction,
  simulateStatusAction,
} from "@/actions/broadcasts";

export default async function AdminBroadcastPage({
  params,
}: PageProps<"/admin/broadcasts/[id]">) {
  const session = await requireAdmin();
  const { id } = await params;

  const broadcast = await getDataSource().getBroadcastById(id);
  if (!broadcast) notFound();
  if (!canManageSchool(session, broadcast.school.id)) redirect("/admin?denied=school");

  const status = await syncBroadcastStatus(broadcast);

  const credentials = broadcast.livekitIngressId
    ? await getStreamCredentials(broadcast.livekitIngressId).catch((error) => {
        console.error("[fluxcast] Could not read stream credentials", error);
        return null;
      })
    : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <AdminRefresher hasActiveBroadcasts={status === "connected" || status === "live"} />

      <Link href="/admin" className="text-sm text-ink-400 transition hover:text-ink-200">
        ← Dashboard
      </Link>

      <header className="mt-4 mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <StatusPill status={status} />
          <span className="text-xs uppercase tracking-wide text-ink-400">
            {broadcast.competition}
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-100 sm:text-3xl">
          {broadcast.matchup}
        </h1>
        <p className="mt-2 text-sm text-ink-400">
          {formatKickoff(broadcast.scheduledStart)}
          {broadcast.location ? ` · ${broadcast.location}` : ""}
        </p>
        <p className="mt-3 text-sm text-ink-300">{STATUS_HINT[status]}</p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Link
            href={`/admin/broadcasts/${broadcast.id}/edit`}
            className="rounded-md border border-ink-700 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-ink-200 transition hover:border-ink-600 hover:bg-ink-800"
          >
            Edit details
          </Link>
          <Link
            href={`/broadcasts/${broadcast.slug}`}
            className="text-sm font-semibold text-flux-400 transition hover:text-flux-300"
          >
            View public page →
          </Link>
        </div>
      </header>

      {credentials ? (
        <StreamDestination credentials={credentials} />
      ) : (
        <div className="rounded-lg border border-ink-800 bg-ink-900 p-5">
          <h2 className="text-base font-bold tracking-tight text-ink-100">
            Stream destination
          </h2>
          <p className="mt-1 mb-4 text-sm text-ink-400">
            {broadcast.livekitIngressId
              ? "This broadcast has a destination, but LiveKit could not be reached to read it. Try again shortly."
              : "Generate an RTMP destination, then point OBS or Restream at it."}
          </p>
          {!broadcast.livekitIngressId && (
            <form action={generateStreamDestinationAction}>
              <input type="hidden" name="broadcastId" value={broadcast.id} />
              <button
                type="submit"
                className="rounded-md bg-flux-400 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-ink-950 transition hover:bg-flux-300"
              >
                Generate stream destination
              </button>
            </form>
          )}
        </div>
      )}

      {streamingMode === "mock" && (
        <section className="mt-8 rounded-lg border border-amber-500/25 bg-amber-500/5 p-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-200">
              Development only
            </span>
            <h2 className="text-sm font-bold text-ink-100">Simulate stream status</h2>
          </div>
          <p className="mb-4 text-xs text-amber-100/80">
            Without LiveKit credentials there is no encoder to connect, so these buttons move
            the broadcast through its states by hand. They disappear once LiveKit is
            configured.
          </p>
          <div className="flex flex-wrap gap-2">
            {(["ready", "connected", "live", "ended", "error"] as const).map((next) => (
              <form action={simulateStatusAction} key={next}>
                <input type="hidden" name="broadcastId" value={broadcast.id} />
                <input type="hidden" name="status" value={next} />
                <button
                  type="submit"
                  disabled={next === status}
                  className="rounded-md border border-ink-700 bg-ink-800 px-3 py-1.5 text-xs font-semibold capitalize text-ink-200 transition hover:border-ink-600 hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {next}
                </button>
              </form>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
