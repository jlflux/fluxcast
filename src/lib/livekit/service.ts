import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { AccessToken, IngressClient, IngressInput } from "livekit-server-sdk";

import { isLiveKitConfigured, serverEnv } from "@/lib/env.server";
import { readIngressSignal, type IngressSignal } from "@/lib/livekit/status";

/**
 * FluxCast's LiveKit integration layer.
 *
 * Everything in this file is server-only. `LIVEKIT_API_SECRET` never leaves the
 * server: the browser receives a short-lived, listen-only access token minted
 * here and nothing else.
 *
 * When LiveKit is not configured, every function returns clearly-labelled
 * development stand-ins so the full admin and listener interface can be
 * exercised. Mock values are always marked `mock: true` so the UI can say so.
 */

export interface StreamCredentials {
  /** RTMP(S) ingest endpoint — paste into OBS "Server". */
  streamUrl: string;
  /** Secret. Paste into OBS "Stream Key". Never persisted by FluxCast. */
  streamKey: string;
  mock: boolean;
}

export interface IngressResult extends StreamCredentials {
  ingressId: string;
}

export interface ListenerToken {
  /** LiveKit websocket URL for the browser to connect to. */
  url: string;
  /** Short-lived, subscribe-only JWT. */
  token: string;
  mock: boolean;
}

/**
 * LiveKit Cloud gives you a `wss://` URL, but the server APIs expect `https://`.
 * Accept either so nobody has to remember which one goes in the env file.
 */
function toHttpUrl(url: string): string {
  return url.replace(/^ws(s)?:\/\//, (_m, s) => (s ? "https://" : "http://"));
}

function toWsUrl(url: string): string {
  return url.replace(/^http(s)?:\/\//, (_m, s) => (s ? "wss://" : "ws://"));
}

function ingressClient(): IngressClient {
  return new IngressClient(
    toHttpUrl(serverEnv.livekitUrl),
    serverEnv.livekitApiKey,
    serverEnv.livekitApiSecret,
  );
}

// ---------------------------------------------------------------------------
// Development stand-ins
// ---------------------------------------------------------------------------

const MOCK_STREAM_URL = "rtmps://development-only.fluxcast.invalid/live";

/**
 * A stable fake stream key for an ingress ID.
 *
 * Derived rather than stored, so mock mode behaves like the real thing: the key
 * can be looked up again later without FluxCast ever keeping one in a database.
 */
function mockStreamKey(ingressId: string): string {
  const digest = createHash("sha256")
    .update(`fluxcast-development-only:${ingressId}`)
    .digest("base64url")
    .slice(0, 28);
  return `DEVELOPMENT-ONLY-${digest}`;
}

function mockCredentials(ingressId: string): StreamCredentials {
  return { streamUrl: MOCK_STREAM_URL, streamKey: mockStreamKey(ingressId), mock: true };
}

// ---------------------------------------------------------------------------
// Ingress
// ---------------------------------------------------------------------------

/**
 * Create an RTMP ingress bound to `roomName`.
 *
 * The ingress publishes into the room as a single participant. Audio-only: we
 * do not request video encoding options, and the listener token forbids
 * publishing, so nothing else can appear in the room.
 */
export async function createBroadcastIngress(params: {
  roomName: string;
  broadcastTitle: string;
}): Promise<IngressResult> {
  if (!isLiveKitConfigured) {
    const ingressId = `IN_DEVELOPMENT_${randomBytes(6).toString("hex")}`;
    return { ingressId, ...mockCredentials(ingressId) };
  }

  const info = await ingressClient().createIngress(IngressInput.RTMP_INPUT, {
    name: params.broadcastTitle,
    roomName: params.roomName,
    participantIdentity: "fluxcast-broadcast",
    participantName: params.broadcastTitle,
    enableTranscoding: true,
  });

  return {
    ingressId: info.ingressId,
    streamUrl: info.url,
    streamKey: info.streamKey,
    mock: false,
  };
}

/**
 * Look up the stream URL and key for an existing ingress.
 *
 * This is why FluxCast has no `stream_key` column: LiveKit is the system of
 * record for the secret, and hands it back on demand.
 */
export async function getStreamCredentials(
  ingressId: string,
): Promise<StreamCredentials | null> {
  if (!isLiveKitConfigured) return mockCredentials(ingressId);

  const [info] = await ingressClient().listIngress({ ingressId });
  if (!info) return null;
  return { streamUrl: info.url, streamKey: info.streamKey, mock: false };
}

/** Ask LiveKit whether audio is currently arriving on this ingress. */
export async function getIngressSignal(ingressId: string): Promise<IngressSignal> {
  if (!isLiveKitConfigured) return "unknown";

  const [info] = await ingressClient().listIngress({ ingressId });
  if (!info) return "unknown";
  return readIngressSignal(info.state?.status);
}

/**
 * Every ingress on the LiveKit project.
 *
 * LiveKit caps how many can exist at once, so this is what makes the quota
 * visible before it blocks an operator mid-setup.
 */
export async function listAllIngresses(): Promise<
  { ingressId: string; name: string; roomName: string }[]
> {
  if (!isLiveKitConfigured) return [];
  const all = await ingressClient().listIngress({});
  return all.map((info) => ({
    ingressId: info.ingressId,
    name: info.name,
    roomName: info.roomName,
  }));
}

/** Remove an ingress. Used when a broadcast is deleted or regenerated. */
export async function deleteBroadcastIngress(ingressId: string): Promise<void> {
  if (!isLiveKitConfigured) return;
  await ingressClient().deleteIngress(ingressId);
}

/**
 * Is a stream destination sitting idle well ahead of its game?
 *
 * LiveKit meters an ingress from the moment it exists, not from the moment an
 * encoder connects, so one generated days early bills for those days without a
 * single listener. Lives here rather than in the component because reading the
 * clock during render is not allowed.
 */
export function isDestinationGeneratedTooEarly(
  scheduledStart: string,
  now: number = Date.now(),
): boolean {
  const hoursUntil = (Date.parse(scheduledStart) - now) / 3_600_000;
  return Number.isFinite(hoursUntil) && hoursUntil > 24;
}

// ---------------------------------------------------------------------------
// Listener tokens
// ---------------------------------------------------------------------------

/** Listener tokens are short-lived; the player reconnects with a fresh one. */
const LISTENER_TOKEN_TTL_SECONDS = 60 * 60 * 4;

/**
 * Mint a listen-only token for an anonymous fan.
 *
 * The grant is deliberately minimal:
 *   canSubscribe     - yes, that is the whole point
 *   canPublish       - no, a fan can never put audio into the broadcast
 *   canPublishData   - no, no chat or data channel abuse
 *   canUpdateOwnMetadata - no
 *   hidden           - yes, listeners do not appear in the participant list,
 *                      so they cannot be enumerated by other listeners
 */
export async function createListenerToken(roomName: string): Promise<ListenerToken> {
  if (!isLiveKitConfigured) {
    return { url: "", token: "", mock: true };
  }

  const identity = `listener-${randomBytes(8).toString("hex")}`;
  const at = new AccessToken(serverEnv.livekitApiKey, serverEnv.livekitApiSecret, {
    identity,
    ttl: LISTENER_TOKEN_TTL_SECONDS,
  });

  at.addGrant({
    room: roomName,
    roomJoin: true,
    canSubscribe: true,
    canPublish: false,
    canPublishData: false,
    canUpdateOwnMetadata: false,
    hidden: true,
  });

  return {
    url: toWsUrl(serverEnv.livekitUrl),
    token: await at.toJwt(),
    mock: false,
  };
}
