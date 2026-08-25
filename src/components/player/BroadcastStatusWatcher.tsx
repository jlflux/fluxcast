"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import type { BroadcastStatus } from "@/lib/types";

/**
 * Polls the broadcast's status and refreshes the page when it changes.
 *
 * A fan who opens the page ten minutes before kickoff should see it flip to
 * LIVE on its own. Polling every 15 seconds is plenty for that and keeps the
 * whole feature to one small component. See `lib/livekit/sync.ts` for why
 * FluxCast polls rather than using webhooks.
 */
const POLL_INTERVAL_MS = 15_000;

export function BroadcastStatusWatcher({
  slug,
  status,
}: {
  slug: string;
  status: BroadcastStatus;
}) {
  const router = useRouter();

  useEffect(() => {
    // Nothing more will happen to a finished broadcast.
    if (status === "ended") return;

    let cancelled = false;

    const check = async () => {
      try {
        const response = await fetch(`/api/broadcasts/${slug}/status`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload: { status?: BroadcastStatus } = await response.json();
        if (!cancelled && payload.status && payload.status !== status) {
          router.refresh();
        }
      } catch {
        // Offline or a transient failure. The next tick will retry.
      }
    };

    const timer = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [slug, status, router]);

  return null;
}
