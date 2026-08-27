"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  generateStreamDestinationAction,
  releaseStreamDestinationAction,
} from "@/actions/broadcasts";
import { emptyFormResultState } from "@/actions/form-state";

/**
 * Create or hand back a broadcast's LiveKit ingress.
 *
 * Both report what LiveKit actually said. Failing to provision a destination
 * used to leave only a server log and a misleading "check your encoder
 * settings" — advice about an encoder that does not exist yet.
 */
export function GenerateDestinationButton({ broadcastId }: { broadcastId: string }) {
  const [state, formAction] = useActionState(
    generateStreamDestinationAction,
    emptyFormResultState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="broadcastId" value={broadcastId} />
      {state.error && (
        <p
          role="alert"
          className="rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
        >
          {state.error}
        </p>
      )}
      <Submit idle="Generate stream destination" busy="Asking LiveKit…" primary />
    </form>
  );
}

export function ReleaseDestinationButton({ broadcastId }: { broadcastId: string }) {
  const [state, formAction] = useActionState(
    releaseStreamDestinationAction,
    emptyFormResultState,
  );

  return (
    <form action={formAction} className="mt-5 flex flex-col gap-3 border-t border-ink-800 pt-5">
      <input type="hidden" name="broadcastId" value={broadcastId} />
      {state.error && (
        <p
          role="alert"
          className="rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
        >
          {state.error}
        </p>
      )}
      {state.success && (
        <p
          role="status"
          className="rounded-md border border-flux-500/30 bg-flux-500/10 px-4 py-3 text-sm text-flux-200"
        >
          {state.success}
        </p>
      )}
      <p className="text-xs text-ink-400">
        LiveKit limits how many stream destinations can exist at once. Releasing this one
        frees a slot — but the URL and key above stop working immediately, so only do it once
        the game is over.
      </p>
      <Submit idle="Release destination" busy="Releasing…" />
    </form>
  );
}

function Submit({
  idle,
  busy,
  primary,
}: {
  idle: string;
  busy: string;
  primary?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        primary
          ? "self-start rounded-md bg-flux-400 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-ink-950 transition hover:bg-flux-300 disabled:opacity-60"
          : "self-start rounded-md border border-ink-700 px-3 py-1.5 text-xs font-semibold text-ink-300 transition hover:border-ink-600 hover:bg-ink-800 disabled:opacity-60"
      }
    >
      {pending ? busy : idle}
    </button>
  );
}
