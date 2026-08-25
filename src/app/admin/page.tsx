import Link from "next/link";

import { requireAdmin } from "@/lib/auth";
import { getDataSource } from "@/lib/data";
import { selectLive, selectPast, selectToday, selectUpcoming } from "@/lib/data/select";
import { syncBroadcastStatuses } from "@/lib/livekit/sync";
import { AdminSection } from "@/components/admin/AdminSection";
import { BroadcastTable } from "@/components/admin/BroadcastTable";
import { AdminRefresher } from "@/components/admin/AdminRefresher";

export default async function AdminDashboardPage() {
  await requireAdmin();

  const broadcasts = await syncBroadcastStatuses(await getDataSource().listBroadcasts());

  const live = selectLive(broadcasts);
  const today = selectToday(broadcasts);
  const upcoming = selectUpcoming(broadcasts);
  const past = selectPast(broadcasts).slice(0, 5);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <AdminRefresher hasActiveBroadcasts={live.length > 0 || today.length > 0} />

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-100">Dashboard</h1>
          <p className="mt-1 text-sm text-ink-400">
            {broadcasts.length} broadcast{broadcasts.length === 1 ? "" : "s"} · {live.length}{" "}
            live now
          </p>
        </div>
        <Link
          href="/admin/broadcasts/new"
          className="rounded-md bg-flux-400 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-ink-950 transition hover:bg-flux-300"
        >
          Create Broadcast
        </Link>
      </div>

      <AdminSection title="Live now" description="Broadcasts LiveKit is currently receiving.">
        <BroadcastTable broadcasts={live} emptyMessage="Nothing is on the air." />
      </AdminSection>

      <AdminSection title="Today" description="Everything scheduled for today.">
        <BroadcastTable broadcasts={today} emptyMessage="No broadcasts scheduled today." />
      </AdminSection>

      <AdminSection title="Upcoming">
        <BroadcastTable broadcasts={upcoming} emptyMessage="No upcoming broadcasts." />
      </AdminSection>

      {past.length > 0 && (
        <AdminSection title="Recently finished">
          <BroadcastTable broadcasts={past} emptyMessage="" />
        </AdminSection>
      )}
    </div>
  );
}
