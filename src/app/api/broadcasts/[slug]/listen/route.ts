import { NextResponse } from "next/server";

import { getDataSource } from "@/lib/data";
import { createListenerToken } from "@/lib/livekit/service";
import { syncBroadcastStatus } from "@/lib/livekit/sync";
import { streamingMode } from "@/lib/env.server";

/**
 * Mint a listen-only LiveKit token for an anonymous fan.
 *
 * Fans never sign in, so this route is public by design. What keeps it safe is
 * the *shape* of what it hands out:
 *
 *   - The token is minted here, on the server. LIVEKIT_API_SECRET is used to
 *     sign it and is never sent to the browser.
 *   - The grant is subscribe-only and scoped to this broadcast's room, so a
 *     token cannot publish audio, send data, or reach another broadcast.
 *   - It is only issued while the broadcast is actually live, so tokens cannot
 *     be farmed ahead of time.
 *
 * POST rather than GET so it is never cached by a browser or CDN.
 */
export async function POST(_request: Request, { params }: RouteContext<"/api/broadcasts/[slug]/listen">) {
  const { slug } = await params;

  const broadcast = await getDataSource().getBroadcastBySlug(slug);
  if (!broadcast) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const status = await syncBroadcastStatus(broadcast);

  if (status !== "live") {
    return NextResponse.json({ error: "not_live", status }, { status: 409 });
  }

  if (streamingMode === "mock") {
    // Nothing to connect to. Say so plainly rather than failing obscurely.
    return NextResponse.json(
      { mock: true, status },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!broadcast.livekitRoomName) {
    console.error(`[fluxcast] Broadcast ${broadcast.id} is live but has no LiveKit room.`);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  const { url, token } = await createListenerToken(broadcast.livekitRoomName);

  return NextResponse.json(
    { url, token, status, mock: false },
    { headers: { "Cache-Control": "no-store" } },
  );
}
