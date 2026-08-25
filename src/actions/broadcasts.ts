"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { getDataSource } from "@/lib/data";
import { wallTimeToIso } from "@/lib/format";
import { buildRoomName } from "@/lib/slug";
import { createBroadcastIngress } from "@/lib/livekit/service";
import { streamingMode } from "@/lib/env.server";
import type { BroadcastStatus } from "@/lib/types";
import type { CreateBroadcastState } from "@/actions/form-state";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Create a game and its broadcast.
 *
 * Stops at 'draft' — generating the LiveKit destination is a separate,
 * explicit step so an ingress is not created for a game that was entered by
 * mistake.
 */
export async function createBroadcastAction(
  _previous: CreateBroadcastState,
  formData: FormData,
): Promise<CreateBroadcastState> {
  await requireAdmin();

  const teamId = text(formData, "teamId");
  const opponentName = text(formData, "opponentName");
  const date = text(formData, "date");
  const time = text(formData, "time");
  const isHome = text(formData, "homeAway") !== "away";
  const location = text(formData, "location");
  const title = text(formData, "title");

  const fieldErrors: Record<string, string> = {};
  if (!teamId) fieldErrors.teamId = "Choose a team.";
  if (!opponentName) fieldErrors.opponentName = "Enter the opponent.";
  if (!date) fieldErrors.date = "Choose a date.";
  if (!time) fieldErrors.time = "Choose a start time.";

  const startTime = date && time ? wallTimeToIso(date, time) : null;
  if (date && time && !startTime) {
    fieldErrors.date = "That date and time could not be read.";
  }

  if (Object.keys(fieldErrors).length > 0 || !startTime) {
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  let broadcastId: string;
  try {
    const broadcast = await getDataSource().createBroadcast({
      teamId,
      opponentName,
      startTime,
      isHome,
      location: location || null,
      title: title || null,
    });
    broadcastId = broadcast.id;
  } catch (error) {
    console.error("[fluxcast] createBroadcast failed", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Something went wrong saving this broadcast.",
      fieldErrors: {},
    };
  }

  revalidatePath("/admin");
  revalidatePath("/");
  // redirect() throws, so it must sit outside the try/catch above.
  redirect(`/admin/broadcasts/${broadcastId}`);
}

/**
 * Create the LiveKit RTMP destination for a broadcast.
 *
 * Generates a room name, creates the ingress, and stores the ingress ID and
 * (non-secret) RTMP URL. The stream key is deliberately not saved — it is
 * fetched back from LiveKit whenever an admin views it.
 */
export async function generateStreamDestinationAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const broadcastId = text(formData, "broadcastId");
  if (!broadcastId) return;

  const data = getDataSource();
  const broadcast = await data.getBroadcastById(broadcastId);
  if (!broadcast) return;

  // Already has a destination — don't orphan an ingress by making a second one.
  if (broadcast.livekitIngressId) return;

  const roomName = buildRoomName(broadcast.slug);

  try {
    const ingress = await createBroadcastIngress({
      roomName,
      broadcastTitle: broadcast.title,
    });

    await data.updateBroadcast(broadcast.id, {
      status: "ready",
      livekitRoomName: roomName,
      livekitIngressId: ingress.ingressId,
      streamUrl: ingress.streamUrl,
    });
  } catch (error) {
    console.error("[fluxcast] createBroadcastIngress failed", error);
    await data.updateBroadcast(broadcast.id, { status: "error" });
  }

  revalidatePath(`/admin/broadcasts/${broadcastId}`);
  revalidatePath("/admin");
}

/**
 * DEVELOPMENT ONLY: move a broadcast through its states by hand.
 *
 * Without LiveKit credentials there is no real encoder to connect, so this is
 * the only way to see the live listener page and the status ladder. It refuses
 * to run once LiveKit is configured — from then on, status comes from LiveKit
 * and nothing else.
 */
export async function simulateStatusAction(formData: FormData): Promise<void> {
  await requireAdmin();

  if (streamingMode !== "mock") return;

  const broadcastId = text(formData, "broadcastId");
  const status = text(formData, "status") as BroadcastStatus;
  if (!broadcastId || !status) return;

  const now = new Date().toISOString();
  await getDataSource().updateBroadcast(broadcastId, {
    status,
    ...(status === "live" && { startedAt: now, endedAt: null }),
    ...(status === "ended" && { endedAt: now }),
  });

  revalidatePath(`/admin/broadcasts/${broadcastId}`);
  revalidatePath("/admin");
  revalidatePath("/");
}
