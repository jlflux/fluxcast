import type { BroadcastStatus } from "@/lib/types";

/**
 * LiveKit `IngressState.Status` values.
 *
 * Mirrored as plain numbers because the generated enum is not re-exported from
 * `livekit-server-sdk`, and reaching into `@livekit/protocol` (a transitive
 * dependency) would be fragile.
 */
export const INGRESS_STATUS = {
  ENDPOINT_INACTIVE: 0,
  ENDPOINT_BUFFERING: 1,
  ENDPOINT_PUBLISHING: 2,
  ENDPOINT_ERROR: 3,
  ENDPOINT_COMPLETE: 4,
} as const;

/**
 * Map LiveKit's ingress state onto a FluxCast broadcast status.
 *
 * This mapping is the whole reason ingress polling is enough for the
 * prototype — LiveKit already tracks exactly the five states we want to show.
 */
export function ingressStatusToBroadcastStatus(
  status: number | undefined,
  previous: BroadcastStatus,
): BroadcastStatus {
  switch (status) {
    case INGRESS_STATUS.ENDPOINT_INACTIVE:
      // Never connected yet, or the encoder disconnected. If we had already
      // gone live, treat a return to inactive as the broadcast having ended.
      return previous === "live" || previous === "connected" ? "ended" : "ready";
    case INGRESS_STATUS.ENDPOINT_BUFFERING:
      return "connected";
    case INGRESS_STATUS.ENDPOINT_PUBLISHING:
      return "live";
    case INGRESS_STATUS.ENDPOINT_ERROR:
      return "error";
    case INGRESS_STATUS.ENDPOINT_COMPLETE:
      return "ended";
    default:
      return previous;
  }
}

/** Human-readable label for each broadcast status. */
export const STATUS_LABEL: Record<BroadcastStatus, string> = {
  draft: "Draft",
  ready: "Ready",
  connected: "Connected",
  live: "Live",
  ended: "Ended",
  error: "Error",
};

/** Short explanation shown to an admin under the status chip. */
export const STATUS_HINT: Record<BroadcastStatus, string> = {
  draft: "No stream destination yet. Generate one to get an RTMP URL and key.",
  ready: "Waiting for your encoder to connect to the stream destination.",
  connected: "Encoder connected. LiveKit is buffering audio.",
  live: "Audio is flowing. Fans can listen now.",
  ended: "This broadcast has finished.",
  error: "LiveKit reported a problem with this stream. Check your encoder settings.",
};
