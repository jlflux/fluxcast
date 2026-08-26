"use client";

import { useEffect } from "react";

/**
 * Publishes the broadcast to the OS media controls.
 *
 * This is what puts FluxCast on a phone's lock screen and in the notification
 * shade, next to the play/pause button, the way a music app appears. A fan can
 * lock the phone, put it in a pocket and still control the game.
 *
 * The Media Session API is progressive: where it is unsupported, or where the
 * browser declines to show controls for a live MediaStream, nothing here
 * breaks — the in-page player keeps working. Support is best on Android
 * Chrome; iOS Safari is less predictable with live streams.
 */
export interface MediaSessionInfo {
  title: string;
  artist: string;
  album: string;
}

export function useMediaSession({
  info,
  playing,
  onPlay,
  onStop,
}: {
  info: MediaSessionInfo;
  playing: boolean;
  onPlay: () => void;
  onStop: () => void;
}) {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;

    session.metadata = new MediaMetadata({
      title: info.title,
      artist: info.artist,
      album: info.album,
      // A data-URI artwork keeps the lock screen from showing a blank tile
      // without shipping an image asset or making a network request.
      artwork: [{ src: FLUXCAST_ARTWORK, sizes: "512x512", type: "image/svg+xml" }],
    });

    return () => {
      session.metadata = null;
    };
  }, [info.title, info.artist, info.album]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;

    session.playbackState = playing ? "playing" : "paused";

    const handlers: [MediaSessionAction, MediaSessionActionHandler | null][] = [
      ["play", () => onPlay()],
      ["pause", () => onStop()],
      ["stop", () => onStop()],
      // A live broadcast has no timeline, so seeking is meaningless. Clearing
      // these stops the OS offering scrub controls that could not work.
      ["seekbackward", null],
      ["seekforward", null],
      ["seekto", null],
      ["previoustrack", null],
      ["nexttrack", null],
    ];

    for (const [action, handler] of handlers) {
      try {
        session.setActionHandler(action, handler);
      } catch {
        // Browser does not support this action; harmless.
      }
    }

    return () => {
      for (const [action] of handlers) {
        try {
          session.setActionHandler(action, null);
        } catch {
          // Same.
        }
      }
    };
  }, [playing, onPlay, onStop]);
}

/** FluxCast mark as an inline SVG data URI — no asset, no network request. */
const FLUXCAST_ARTWORK =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <rect width="512" height="512" fill="#07080b"/>
      <path d="M296 64 144 288h96l-24 160 152-224h-96l24-160Z" fill="#2ed3e9"/>
    </svg>`,
  );
