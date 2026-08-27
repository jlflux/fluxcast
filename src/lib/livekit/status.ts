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
 * What LiveKit's ingress state means for a broadcast.
 *
 * Deliberately does NOT decide "ended". Losing the encoder is indistinguishable
 * from a broadcast finishing, and guessing wrong is expensive in one direction:
 * marking a broadcast ended is terminal, so a dropped connection in the third
 * quarter would kill it for good. `syncBroadcastStatus` layers the
 * interruption and grace-period rules on top of this.
 */
export type IngressSignal = "publishing" | "buffering" | "encoder-gone" | "error" | "unknown";

export function readIngressSignal(status: number | undefined): IngressSignal {
  switch (status) {
    case INGRESS_STATUS.ENDPOINT_PUBLISHING:
      return "publishing";
    case INGRESS_STATUS.ENDPOINT_BUFFERING:
      return "buffering";
    case INGRESS_STATUS.ENDPOINT_INACTIVE:
    // COMPLETE is grouped with INACTIVE on purpose. Either way the encoder is
    // gone and the ingress can be reconnected to with the same URL and key, so
    // neither is proof the broadcast is over.
    case INGRESS_STATUS.ENDPOINT_COMPLETE:
      return "encoder-gone";
    case INGRESS_STATUS.ENDPOINT_ERROR:
      return "error";
    default:
      return "unknown";
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
