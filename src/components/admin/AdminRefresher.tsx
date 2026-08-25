"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Refreshes the dashboard periodically so status changes appear without the
 * operator reloading. Polls faster while something is on today's schedule,
 * slowly otherwise.
 */
export function AdminRefresher({ hasActiveBroadcasts }: { hasActiveBroadcasts: boolean }) {
  const router = useRouter();

  useEffect(() => {
    const interval = hasActiveBroadcasts ? 10_000 : 60_000;
    const timer = setInterval(() => router.refresh(), interval);
    return () => clearInterval(timer);
  }, [hasActiveBroadcasts, router]);

  return null;
}
