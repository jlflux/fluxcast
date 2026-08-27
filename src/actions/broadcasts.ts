"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { canManageSchool, requireAdmin, requireSuperAdmin } from "@/lib/auth";
import { getDataSource } from "@/lib/data";
import { wallTimeToIso } from "@/lib/format";
import { buildMatchup, buildRoomName } from "@/lib/slug";
import { createBroadcastIngress, deleteBroadcastIngress } from "@/lib/livekit/service";
import { streamingMode } from "@/lib/env.server";
import type { BroadcastStatus } from "@/lib/types";
import type { CreateBroadcastState, FormResultState } from "@/actions/form-state";

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
  const session = await requireAdmin();

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

  // A school admin may only create broadcasts for their own school's teams.
  const teams = await getDataSource().listTeamOptions();
  const team = teams.find((t) => t.id === teamId);
  if (!team) {
    return { error: "That team no longer exists.", fieldErrors: {} };
  }
  if (!canManageSchool(session, team.schoolId)) {
    return { error: "You do not have access to that school.", fieldErrors: {} };
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
export async function generateStreamDestinationAction(
  _previous: FormResultState,
  formData: FormData,
): Promise<FormResultState> {
  const session = await requireAdmin();

  const broadcastId = text(formData, "broadcastId");
  if (!broadcastId) {
    return { error: "Missing broadcast.", fieldErrors: {}, success: null };
  }

  const data = getDataSource();
  const broadcast = await data.getBroadcastById(broadcastId);
  if (!broadcast) {
    return { error: "That broadcast no longer exists.", fieldErrors: {}, success: null };
  }
  if (!canManageSchool(session, broadcast.school.id)) {
    return { error: "You do not have access to that school.", fieldErrors: {}, success: null };
  }

  // Already has a destination — don't orphan an ingress by making a second one.
  if (broadcast.livekitIngressId) {
    return { error: null, fieldErrors: {}, success: "This broadcast already has a destination." };
  }

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

    // NOT status 'error'. That means "the stream errored", and its hint tells
    // the operator to check their encoder — there is no encoder yet. Failing to
    // provision leaves the broadcast exactly as it was, ready to retry.
    return {
      error: `LiveKit would not create the stream destination: ${describeLiveKitError(error)}`,
      fieldErrors: {},
      success: null,
    };
  }

  revalidatePath(`/admin/broadcasts/${broadcastId}`);
  revalidatePath("/admin");
  return { error: null, fieldErrors: {}, success: "Stream destination created." };
}

/**
 * Make a LiveKit failure actionable.
 *
 * The SDK's errors carry the useful part in different places depending on
 * whether the call was rejected by the API, by the network, or by auth, and the
 * default string is often just "fetch failed".
 */
function describeLiveKitError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);

  const parts = [error.message];
  const cause = (error as { cause?: unknown }).cause;
  if (cause instanceof Error) parts.push(cause.message);

  const message = parts.filter(Boolean).join(" — ");

  if (/limit|quota|exceed|too many|concurrent/i.test(message)) {
    return `${message}. This usually means the LiveKit project's concurrent ingress limit is reached. Release the destination on a finished broadcast to free one, or raise the limit in LiveKit Cloud.`;
  }
  if (/unauthorized|invalid api key|401|permission/i.test(message)) {
    return `${message}. Check LIVEKIT_API_KEY and LIVEKIT_API_SECRET — a key from a different project will fail this way.`;
  }
  if (/not found|404/i.test(message)) {
    return `${message}. Check LIVEKIT_URL points at this project.`;
  }
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|timeout/i.test(message)) {
    return `${message}. FluxCast could not reach LiveKit at all — check LIVEKIT_URL.`;
  }
  if (/ingress/i.test(message) && /enabled|disabled|not available/i.test(message)) {
    return `${message}. Ingress may not be enabled on this LiveKit project.`;
  }
  return message;
}

/**
 * Release a broadcast's LiveKit ingress.
 *
 * LiveKit projects cap how many ingresses can exist at once, and FluxCast
 * creates one per broadcast. Without a way to hand them back, a handful of test
 * broadcasts exhausts the quota and no new destination can be created.
 *
 * Releasing invalidates that stream URL and key. Generating again mints a new
 * pair, so anything already pasted into OBS stops working.
 */
export async function releaseStreamDestinationAction(
  _previous: FormResultState,
  formData: FormData,
): Promise<FormResultState> {
  const session = await requireAdmin();

  const broadcastId = text(formData, "broadcastId");
  if (!broadcastId) {
    return { error: "Missing broadcast.", fieldErrors: {}, success: null };
  }

  const data = getDataSource();
  const broadcast = await data.getBroadcastById(broadcastId);
  if (!broadcast) {
    return { error: "That broadcast no longer exists.", fieldErrors: {}, success: null };
  }
  if (!canManageSchool(session, broadcast.school.id)) {
    return { error: "You do not have access to that school.", fieldErrors: {}, success: null };
  }
  if (!broadcast.livekitIngressId) {
    return { error: null, fieldErrors: {}, success: "There was no destination to release." };
  }

  try {
    await deleteBroadcastIngress(broadcast.livekitIngressId);
  } catch (error) {
    console.error("[fluxcast] deleteBroadcastIngress failed", error);
    // Clear our side anyway: a LiveKit ingress we cannot delete is still not
    // one this broadcast should keep pointing at.
    console.warn(`[fluxcast] Clearing ingress ${broadcast.livekitIngressId} locally regardless.`);
  }

  await data.updateBroadcast(broadcast.id, {
    status: broadcast.status === "ended" ? "ended" : "draft",
    livekitIngressId: null,
    livekitRoomName: null,
    streamUrl: null,
    interruptedAt: null,
  });

  revalidatePath(`/admin/broadcasts/${broadcastId}`);
  revalidatePath("/admin");
  return {
    error: null,
    fieldErrors: {},
    success: "Destination released. That stream URL and key no longer work.",
  };
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
  const session = await requireAdmin();

  if (streamingMode !== "mock") return;

  const broadcastId = text(formData, "broadcastId");
  const status = text(formData, "status") as BroadcastStatus;
  if (!broadcastId || !status) return;

  const existing = await getDataSource().getBroadcastById(broadcastId);
  if (!existing || !canManageSchool(session, existing.school.id)) return;

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


/**
 * Correct the details of an existing broadcast.
 *
 * The slug — the public URL — is deliberately not regenerated. A school may
 * already have shared the link, and fixing a typo should not break it.
 */
export async function updateBroadcastAction(
  _previous: FormResultState,
  formData: FormData,
): Promise<FormResultState> {
  const session = await requireAdmin();

  const broadcastId = text(formData, "broadcastId");
  const opponentName = text(formData, "opponentName");
  const date = text(formData, "date");
  const time = text(formData, "time");
  const isHome = text(formData, "homeAway") !== "away";
  const location = text(formData, "location");
  const title = text(formData, "title");

  const data = getDataSource();
  const existing = broadcastId ? await data.getBroadcastById(broadcastId) : null;
  if (!existing) {
    return { error: "That broadcast no longer exists.", fieldErrors: {}, success: null };
  }
  if (!canManageSchool(session, existing.school.id)) {
    return { error: "You do not have access to that school.", fieldErrors: {}, success: null };
  }

  const fieldErrors: Record<string, string> = {};
  if (!opponentName) fieldErrors.opponentName = "Enter the opponent.";
  if (!date) fieldErrors.date = "Choose a date.";
  if (!time) fieldErrors.time = "Choose a start time.";

  const startTime = date && time ? wallTimeToIso(date, time) : null;
  if (date && time && !startTime) {
    fieldErrors.date = "That date and time could not be read.";
  }

  if (Object.keys(fieldErrors).length > 0 || !startTime) {
    return { error: "Please fix the highlighted fields.", fieldErrors, success: null };
  }

  try {
    await data.updateBroadcastDetails(existing.id, {
      opponentName,
      startTime,
      isHome,
      location: location || null,
      title:
        title.trim() ||
        buildMatchup(existing.school.shortName, opponentName, isHome),
    });
  } catch (error) {
    console.error("[fluxcast] updateBroadcastDetails failed", error);
    return {
      error: error instanceof Error ? error.message : "Could not save those changes.",
      fieldErrors: {},
      success: null,
    };
  }

  revalidatePath(`/admin/broadcasts/${existing.id}`);
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath(`/broadcasts/${existing.slug}`);

  return { error: null, fieldErrors: {}, success: "Changes saved." };
}

/** Create a team. School admins may only add teams to their own school. */
export async function createTeamAction(
  _previous: FormResultState,
  formData: FormData,
): Promise<FormResultState> {
  const session = await requireAdmin();

  const schoolId = text(formData, "schoolId");
  const sportId = text(formData, "sportId");
  const level = text(formData, "level") || "Varsity";
  const gender = text(formData, "gender");

  if (!schoolId || !sportId) {
    return {
      error: "Choose a school and a sport.",
      fieldErrors: {
        ...(schoolId ? {} : { schoolId: "Choose a school." }),
        ...(sportId ? {} : { sportId: "Choose a sport." }),
      },
      success: null,
    };
  }

  if (!canManageSchool(session, schoolId)) {
    return { error: "You do not have access to that school.", fieldErrors: {}, success: null };
  }

  try {
    const team = await getDataSource().createTeam({
      schoolId,
      sportId,
      level,
      gender: gender || null,
    });
    revalidatePath("/admin/teams");
    revalidatePath("/admin/broadcasts/new");
    return { error: null, fieldErrors: {}, success: `Created ${team.label}.` };
  } catch (error) {
    console.error("[fluxcast] createTeam failed", error);
    return {
      error: error instanceof Error ? error.message : "Could not create that team.",
      fieldErrors: {},
      success: null,
    };
  }
}

/** Create a school. FluxCast staff only. */
export async function createSchoolAction(
  _previous: FormResultState,
  formData: FormData,
): Promise<FormResultState> {
  await requireSuperAdmin();

  const name = text(formData, "name");
  const shortName = text(formData, "shortName") || name;
  if (!name) {
    return {
      error: "Enter the school name.",
      fieldErrors: { name: "Enter the school name." },
      success: null,
    };
  }

  try {
    const school = await getDataSource().createSchool({
      name,
      shortName,
      mascot: text(formData, "mascot") || null,
      city: text(formData, "city") || null,
      state: text(formData, "state") || null,
      primaryColor: text(formData, "primaryColor") || null,
    });
    revalidatePath("/admin/schools");
    revalidatePath("/admin/teams");
    revalidatePath("/");
    return {
      error: null,
      fieldErrors: {},
      success: `Created ${school.name}. Its page is at /schools/${school.slug}.`,
    };
  } catch (error) {
    console.error("[fluxcast] createSchool failed", error);
    return {
      error: error instanceof Error ? error.message : "Could not create that school.",
      fieldErrors: {},
      success: null,
    };
  }
}


/**
 * End a broadcast by hand.
 *
 * Losing the encoder no longer ends a broadcast on its own — that is what lets
 * a dropped stream come back — so an operator needs a way to say "the game is
 * over". Without this, a finished broadcast would sit on the homepage saying
 * "reconnecting" until the grace period ran out.
 *
 * The LiveKit ingress is deliberately left in place: it costs nothing idle,
 * and keeping it means the same stream URL and key still work if the broadcast
 * is reopened.
 */
export async function endBroadcastAction(formData: FormData): Promise<void> {
  const session = await requireAdmin();

  const broadcastId = text(formData, "broadcastId");
  if (!broadcastId) return;

  const data = getDataSource();
  const broadcast = await data.getBroadcastById(broadcastId);
  if (!broadcast) return;
  if (!canManageSchool(session, broadcast.school.id)) return;

  const now = new Date().toISOString();
  await data.updateBroadcast(broadcast.id, {
    status: "ended",
    endedAt: now,
    interruptedAt: null,
    ...(broadcast.startedAt ? {} : { startedAt: now }),
  });

  revalidatePath(`/admin/broadcasts/${broadcast.id}`);
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath(`/broadcasts/${broadcast.slug}`);
}

/**
 * Reopen a broadcast that was ended.
 *
 * `ended` stops FluxCast polling LiveKit, so a broadcast ended by mistake --
 * or one whose grace period expired during a long outage -- would otherwise
 * stay dead even with the encoder streaming again.
 */
export async function reopenBroadcastAction(formData: FormData): Promise<void> {
  const session = await requireAdmin();

  const broadcastId = text(formData, "broadcastId");
  if (!broadcastId) return;

  const data = getDataSource();
  const broadcast = await data.getBroadcastById(broadcastId);
  if (!broadcast) return;
  if (!canManageSchool(session, broadcast.school.id)) return;
  if (!broadcast.livekitIngressId) return;

  await data.updateBroadcast(broadcast.id, {
    status: "ready",
    endedAt: null,
    interruptedAt: null,
  });

  revalidatePath(`/admin/broadcasts/${broadcast.id}`);
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath(`/broadcasts/${broadcast.slug}`);
}
