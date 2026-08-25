import Link from "next/link";

import type { BroadcastView } from "@/lib/types";
import { formatKickoff } from "@/lib/format";
import { StatusPill } from "@/components/ui/StatusPill";

/** Conventional admin table. Collapses to stacked rows on small screens. */
export function BroadcastTable({
  broadcasts,
  emptyMessage,
}: {
  broadcasts: BroadcastView[];
  emptyMessage: string;
}) {
  if (broadcasts.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-ink-800 px-4 py-6 text-center text-sm text-ink-400">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-ink-800">
      <table className="w-full border-collapse text-sm">
        <thead className="hidden bg-ink-900 sm:table-header-group">
          <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
            <th className="px-4 py-2.5 font-semibold">Broadcast</th>
            <th className="px-4 py-2.5 font-semibold">Kickoff</th>
            <th className="px-4 py-2.5 font-semibold">Status</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-800">
          {broadcasts.map((broadcast) => (
            <tr
              key={broadcast.id}
              className="flex flex-col gap-1 bg-ink-900/50 px-4 py-3 sm:table-row sm:gap-0 sm:px-0 sm:py-0"
            >
              <td className="sm:px-4 sm:py-3">
                <span className="font-semibold text-ink-100">{broadcast.matchup}</span>
                <span className="block text-xs text-ink-400">{broadcast.competition}</span>
              </td>
              <td className="text-ink-300 sm:px-4 sm:py-3">
                {formatKickoff(broadcast.scheduledStart)}
              </td>
              <td className="sm:px-4 sm:py-3">
                <StatusPill status={broadcast.status} />
              </td>
              <td className="sm:px-4 sm:py-3 sm:text-right">
                <Link
                  href={`/admin/broadcasts/${broadcast.id}`}
                  className="text-sm font-semibold text-flux-400 transition hover:text-flux-300"
                >
                  Manage
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
