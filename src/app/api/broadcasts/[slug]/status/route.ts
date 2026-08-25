import { NextResponse } from "next/server";

import { getDataSource } from "@/lib/data";
import { syncBroadcastStatus } from "@/lib/livekit/sync";
import { streamingMode } from "@/lib/env.server";

/**
 * Current status of a broadcast.
 *
 * Public and unauthenticated — it returns nothing a fan could not already see
 * on the page. Both the listener page and the admin dashboard poll this.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/broadcasts/[slug]/status">) {
  const { slug } = await params;

  const broadcast = await getDataSource().getBroadcastBySlug(slug);
  if (!broadcast) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const status = await syncBroadcastStatus(broadcast);

  return NextResponse.json(
    { slug, status, mock: streamingMode === "mock" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
