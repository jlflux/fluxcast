import type { BroadcastStatus } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/livekit/status";

const STYLES: Record<BroadcastStatus, string> = {
  draft: "bg-ink-800 text-ink-300 ring-ink-700",
  ready: "bg-flux-500/10 text-flux-300 ring-flux-500/30",
  connected: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
  live: "bg-live/15 text-live ring-live/40",
  ended: "bg-ink-800 text-ink-400 ring-ink-700",
  error: "bg-rose-500/10 text-rose-300 ring-rose-500/30",
};

/** Compact status chip used throughout the admin area. */
export function StatusPill({ status }: { status: BroadcastStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ring-1 ring-inset ${STYLES[status]}`}
    >
      {status === "live" && (
        <span className="size-1.5 animate-live-pulse rounded-full bg-live" aria-hidden />
      )}
      {STATUS_LABEL[status]}
    </span>
  );
}
