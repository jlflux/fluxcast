"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from "livekit-client";

import type { BroadcastStatus } from "@/lib/types";

/**
 * The fan-facing audio player.
 *
 * Connection flow:
 *   1. The fan taps LISTEN LIVE. That user gesture matters — browsers block
 *      audio that starts without one, so the whole connection happens inside
 *      the click handler.
 *   2. We ask our own server for a listen-only token (POST, never cached).
 *   3. We connect to LiveKit and attach the first audio track we're subscribed
 *      to onto a plain <audio> element.
 *
 * AUDIO ONLY, DELIBERATELY. Encoders like OBS always send a video track, and
 * the LiveKit ingress republishes it. Left alone, every listener would download
 * that video and never see a pixel of it — a large, invisible mobile data bill.
 * So we connect with `autoSubscribe: false` and subscribe only to audio
 * publications. Video reaches LiveKit but never reaches a fan.
 *
 * No account, no publishing permission, and no LiveKit secret in the browser.
 *
 * Errors are logged to the console for us and translated into plain language
 * for the fan — nobody listening to a football game should see "signal
 * connection failed: 1006".
 */

type PlayerState =
  | "idle"
  | "connecting"
  | "buffering"
  | "playing"
  | "reconnecting"
  | "ended"
  | "error"
  | "unavailable"
  | "devmode";

const MESSAGES: Record<PlayerState, string> = {
  idle: "Tap to join the broadcast.",
  connecting: "Connecting to the broadcast…",
  buffering: "Connected. Waiting for audio…",
  playing: "You're listening live.",
  reconnecting: "Connection dropped. Reconnecting…",
  ended: "This broadcast has ended.",
  error: "We couldn't connect to this broadcast. Please try again in a moment.",
  unavailable: "This broadcast isn't on the air right now.",
  devmode: "There is no audio source connected to this broadcast.",
};

export function ListenLivePlayer({
  slug,
  initialStatus,
}: {
  slug: string;
  initialStatus: BroadcastStatus;
}) {
  const [state, setState] = useState<PlayerState>("idle");
  const [volume, setVolume] = useState(1);
  /** Set when the server is running without LiveKit credentials. */
  const [devNotice, setDevNotice] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const teardown = useCallback(() => {
    roomRef.current?.disconnect();
    roomRef.current = null;
  }, []);

  useEffect(() => teardown, [teardown]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const connect = useCallback(async () => {
    if (roomRef.current) return;
    setDevNotice(false);
    setState("connecting");

    let payload: {
      url?: string;
      token?: string;
      mock?: boolean;
      error?: string;
      status?: BroadcastStatus;
    };

    try {
      const response = await fetch(`/api/broadcasts/${slug}/listen`, { method: "POST" });
      payload = await response.json();

      if (!response.ok) {
        if (payload.error === "not_live") {
          setState(payload.status === "ended" ? "ended" : "unavailable");
        } else {
          console.error("[fluxcast] listen token request failed", payload);
          setState("error");
        }
        return;
      }
    } catch (error) {
      console.error("[fluxcast] listen token request threw", error);
      setState("error");
      return;
    }

    if (payload.mock || !payload.url || !payload.token) {
      // Development mode: there is genuinely nothing to play.
      setDevNotice(true);
      setState("devmode");
      return;
    }

    const room = new Room({ adaptiveStream: false, dynacast: false });
    roomRef.current = room;

    /** Subscribe to a publication only when it carries audio. */
    const subscribeIfAudio = (publication: RemoteTrackPublication) => {
      if (publication.kind === Track.Kind.Audio && !publication.isSubscribed) {
        publication.setSubscribed(true);
      }
    };

    const subscribeAudioOf = (participant: RemoteParticipant) => {
      participant.trackPublications.forEach(subscribeIfAudio);
    };

    room
      .on(RoomEvent.TrackPublished, subscribeIfAudio)
      .on(RoomEvent.ParticipantConnected, subscribeAudioOf)
      .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind !== Track.Kind.Audio) return;
        const element = audioRef.current;
        if (!element) return;
        track.attach(element);
        element.volume = volume;
        void element.play().catch((error) => {
          console.warn("[fluxcast] audio playback was blocked", error);
        });
        setState("playing");
      })
      .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        if (track.kind !== Track.Kind.Audio) return;
        track.detach();
        setState((current) => (current === "playing" ? "buffering" : current));
      })
      .on(RoomEvent.Reconnecting, () => setState("reconnecting"))
      .on(RoomEvent.Reconnected, () => setState("buffering"))
      .on(RoomEvent.Disconnected, () => {
        roomRef.current = null;
        setState((current) => (current === "playing" ? "ended" : current));
      });

    try {
      // autoSubscribe: false — see the note at the top of this file. Without it
      // the client pulls the ingress's video track and throws it away.
      await room.connect(payload.url, payload.token, { autoSubscribe: false });

      // Anything already published before we joined (the usual case: the
      // broadcast was live first) needs subscribing explicitly.
      room.remoteParticipants.forEach(subscribeAudioOf);
      // Safari in particular needs an explicit nudge inside the gesture.
      await room.startAudio().catch(() => undefined);
      setState((current) => (current === "playing" ? current : "buffering"));
    } catch (error) {
      console.error("[fluxcast] LiveKit connection failed", error);
      teardown();
      setState("error");
    }
  }, [slug, teardown, volume]);

  const stop = useCallback(() => {
    teardown();
    setState("idle");
  }, [teardown]);

  const isConnecting = state === "connecting" || state === "reconnecting";
  const isConnected = state === "playing" || state === "buffering" || isConnecting;

  if (initialStatus !== "live" && state === "idle") {
    return null;
  }

  return (
    <div className="rounded-2xl border border-ink-800 bg-ink-900 p-5 sm:p-6">
      {/* Hidden sink for the subscribed LiveKit audio track. */}
      <audio ref={audioRef} className="hidden" />

      <div className="flex flex-col gap-4">
        {isConnected ? (
          <button
            type="button"
            onClick={stop}
            className="w-full rounded-xl border border-ink-700 bg-ink-800 px-6 py-4 text-base font-extrabold uppercase tracking-wide text-ink-100 transition hover:bg-ink-700 sm:text-lg"
          >
            {isConnecting ? "Connecting…" : "Stop Listening"}
          </button>
        ) : (
          <button
            type="button"
            onClick={connect}
            className="w-full rounded-xl bg-flux-400 px-6 py-4 text-base font-extrabold uppercase tracking-wide text-ink-950 shadow-lg shadow-flux-500/20 transition hover:bg-flux-300 sm:text-lg"
          >
            Listen Live
          </button>
        )}

        <p
          className="text-center text-sm text-ink-300"
          role="status"
          aria-live="polite"
        >
          {MESSAGES[state]}
        </p>

        {devNotice && (
          <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-100/90">
            <span className="font-bold uppercase tracking-wide">Development mode</span> — no
            LiveKit credentials are configured, so there is no audio to play.
          </p>
        )}

        {state === "playing" && (
          <label className="flex items-center gap-3 text-xs text-ink-400">
            <span className="eyebrow">Volume</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(event) => setVolume(Number(event.target.value))}
              className="h-1 flex-1 cursor-pointer accent-flux-400"
              aria-label="Volume"
            />
          </label>
        )}
      </div>
    </div>
  );
}
