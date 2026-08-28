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
import { LevelMeter } from "@/components/player/LevelMeter";
import { useMediaSession } from "@/components/player/useMediaSession";
import { getListenerKey } from "@/components/player/listenerKey";

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
 * SURVIVING A DROPPED STREAM. A broadcast losing its encoder is normal — a van
 * moves, a router reboots, someone restarts OBS. The listener stays in the
 * LiveKit room throughout: when the publisher goes the player says it is
 * waiting, and when the feed returns the track is republished and playback
 * resumes on its own, with no tap required. If the listener's own connection
 * drops instead, it rejoins with backoff. Only pressing Stop ends it.
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
  | "waiting"
  | "reconnecting"
  | "ended"
  | "error"
  | "unavailable"
  | "devmode";

/** How often a listening device reports in, so its session window stays open. */
const HEARTBEAT_MS = 30_000;

const MESSAGES: Record<PlayerState, string> = {
  idle: "Tap to join the broadcast.",
  connecting: "Connecting to the broadcast…",
  buffering: "Connected. Waiting for audio…",
  playing: "You're listening live.",
  waiting: "The broadcast dropped out. Waiting for it to come back…",
  reconnecting: "Reconnecting…",
  ended: "This broadcast has ended.",
  error: "We couldn't connect to this broadcast. Please try again in a moment.",
  unavailable: "This broadcast isn't on the air right now.",
  devmode: "There is no audio source connected to this broadcast.",
};

export function ListenLivePlayer({
  slug,
  initialStatus,
  interrupted = false,
  matchup,
  competition,
  schoolName,
}: {
  slug: string;
  initialStatus: BroadcastStatus;
  /** The broadcast went live and is mid-dropout. */
  interrupted?: boolean;
  /** Shown on the phone's lock screen. */
  matchup: string;
  competition: string;
  schoolName: string;
}) {
  const [state, setState] = useState<PlayerState>("idle");
  const [volume, setVolume] = useState(1);
  /** Set when the server is running without LiveKit credentials. */
  const [devNotice, setDevNotice] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const roomRef = useRef<Room | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  /** Set when the fan presses Stop, so we do not fight their decision. */
  const stoppedByUserRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const retryCountRef = useRef(0);

  const teardown = useCallback(() => {
    clearTimeout(retryTimerRef.current);
    roomRef.current?.disconnect();
    roomRef.current = null;
    setAnalyser(null);
    void audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
  }, []);

  /**
   * `connect` is recreated on each render, so a reconnect scheduled from an
   * event handler needs the current one — hence a ref rather than a closure.
   */
  const connectRef = useRef<() => Promise<void>>(async () => {});

  /** Retry with backoff, capped so a long outage does not hammer the server. */
  const scheduleRetry = useCallback(() => {
    if (stoppedByUserRef.current) return;
    const attempt = retryCountRef.current++;
    const delay = Math.min(2000 * 2 ** Math.min(attempt, 4), 30_000);
    clearTimeout(retryTimerRef.current);
    retryTimerRef.current = setTimeout(() => {
      void connectRef.current();
    }, delay);
  }, []);

  useEffect(() => teardown, [teardown]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const connect = useCallback(async () => {
    if (roomRef.current) return;
    stoppedByUserRef.current = false;
    setDevNotice(false);
    setState((current) => (current === "idle" ? "connecting" : current));

    let payload: {
      url?: string;
      token?: string;
      mock?: boolean;
      error?: string;
      status?: BroadcastStatus;
    };

    try {
      const response = await fetch(`/api/broadcasts/${slug}/listen`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ listenerKey: getListenerKey(slug) }),
      });
      payload = await response.json();

      if (!response.ok) {
        if (payload.error === "not_live") {
          if (payload.status === "ended") {
            stoppedByUserRef.current = true;
            setState("ended");
          } else if (retryCountRef.current > 0) {
            // Mid-reconnect and the feed is not back yet. Keep waiting rather
            // than telling a fan the game is off the air.
            setState("waiting");
            scheduleRetry();
          } else {
            setState("unavailable");
          }
        } else {
          console.error("[fluxcast] listen token request failed", payload);
          setState("error");
          scheduleRetry();
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

    /**
     * Tap the incoming audio for the level meter.
     *
     * The analyser is deliberately NOT connected to the audio destination —
     * the <audio> element is already playing the track, and connecting both
     * would play it twice. This is a read-only tap.
     *
     * Wrapped in try/catch because a browser that refuses to build a
     * MediaStream source should cost us a meter, never the audio.
     */
    const attachAnalyser = (track: RemoteTrack) => {
      try {
        const mediaStreamTrack = track.mediaStreamTrack;
        if (!mediaStreamTrack) return;
        const context = new AudioContext();
        audioContextRef.current = context;
        void context.resume().catch(() => undefined);

        const source = context.createMediaStreamSource(new MediaStream([mediaStreamTrack]));
        const node = context.createAnalyser();
        node.fftSize = 512;
        node.smoothingTimeConstant = 0.7;
        source.connect(node);
        setAnalyser(node);
      } catch (error) {
        console.warn("[fluxcast] level meter unavailable", error);
      }
    };

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
        attachAnalyser(track);
        setState("playing");
      })
      .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        if (track.kind !== Track.Kind.Audio) return;
        track.detach();
        setAnalyser(null);
        // The publisher went away, not us. Stay in the room and wait — when
        // the encoder reconnects the track is republished and TrackSubscribed
        // fires again, resuming playback with no tap from the fan.
        setState((current) =>
          current === "playing" || current === "buffering" ? "waiting" : current,
        );
      })
      .on(RoomEvent.ParticipantDisconnected, () => {
        setState((current) => (current === "playing" ? "waiting" : current));
      })
      .on(RoomEvent.Reconnecting, () => setState("reconnecting"))
      .on(RoomEvent.Reconnected, () => setState("waiting"))
      .on(RoomEvent.Disconnected, () => {
        // Our own connection gave up. LiveKit already retried internally, so
        // rejoin from scratch with a fresh token.
        roomRef.current = null;
        setAnalyser(null);
        if (stoppedByUserRef.current) return;
        setState("reconnecting");
        scheduleRetry();
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
      retryCountRef.current = 0;
      setState((current) => (current === "playing" ? current : "buffering"));
    } catch (error) {
      console.error("[fluxcast] LiveKit connection failed", error);
      roomRef.current = null;
      setState("reconnecting");
      scheduleRetry();
    }
  }, [slug, volume, scheduleRetry]);

  // Keep the ref pointing at the latest connect for scheduled retries.
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const stop = useCallback(() => {
    stoppedByUserRef.current = true;
    retryCountRef.current = 0;
    teardown();
    setState("idle");
  }, [teardown]);

  /**
   * Keep this device's listening session open while audio is actually playing.
   *
   * An open tab on the page is not an audience member — only a device with
   * sound coming out of it counts, which is why this lives here rather than in
   * the status poller.
   */
  useEffect(() => {
    if (state !== "playing") return;

    const beat = () => {
      void fetch(
        `/api/broadcasts/${slug}/status?lk=${encodeURIComponent(getListenerKey(slug))}`,
        { cache: "no-store" },
      ).catch(() => undefined);
    };

    beat();
    const timer = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [state, slug]);

  // Put the broadcast on the phone's lock screen and notification shade.
  useMediaSession({
    info: { title: matchup, artist: competition, album: `${schoolName} on FluxCast` },
    playing: state === "playing",
    onPlay: connect,
    onStop: stop,
  });

  const isConnecting = state === "connecting" || state === "reconnecting";
  const isConnected =
    state === "playing" || state === "buffering" || state === "waiting" || isConnecting;

  // Render while live, while mid-dropout, or whenever we are already connected.
  if (initialStatus !== "live" && !interrupted && state === "idle") {
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
            {state === "connecting" ? "Connecting…" : "Stop Listening"}
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

        {(state === "playing" || state === "buffering" || state === "waiting") && (
          <LevelMeter analyser={analyser} active={state === "playing"} />
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
