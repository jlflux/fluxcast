"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { deleteBroadcastAction } from "@/actions/broadcasts";
import { emptyFormResultState } from "@/actions/form-state";

/**
 * Permanently remove a broadcast and its game.
 *
 * Deliberately two steps. This is the only irreversible action in the admin
 * area, and it sits next to buttons an operator presses during a game.
 */
export function DeleteBroadcast({
  broadcastId,
  matchup,
  isLive,
  hasDestination,
}: {
  broadcastId: string;
  matchup: string;
  isLive: boolean;
  hasDestination: boolean;
}) {
  const [state, formAction] = useActionState(deleteBroadcastAction, emptyFormResultState);
  const [confirming, setConfirming] = useState(false);

  return (
    <section className="mt-8 rounded-lg border border-rose-500/25 bg-rose-500/5 p-5">
      <h2 className="text-base font-bold tracking-tight text-ink-100">Delete this broadcast</h2>
      <p className="mt-1 text-sm text-ink-400">
        Removes <span className="text-ink-200">{matchup}</span> and its game from FluxCast, for
        fans and admins alike. This cannot be undone.
      </p>

      {state.error && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
        >
          {state.error}
        </p>
      )}

      {isLive ? (
        <p className="mt-4 rounded-md border border-ink-800 bg-ink-950 px-4 py-3 text-sm text-ink-300">
          This broadcast is on the air. End it first — deleting a live game would cut off
          anyone listening.
        </p>
      ) : !confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-4 rounded-md border border-rose-500/40 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-rose-200 transition hover:bg-rose-500/10"
        >
          Delete broadcast
        </button>
      ) : (
        <form action={formAction} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="broadcastId" value={broadcastId} />
          <p className="text-sm text-rose-100">
            Delete <span className="font-semibold">{matchup}</span> permanently?
            {hasDestination && " Its stream URL and key will stop working."}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <ConfirmButton />
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-sm text-ink-400 transition hover:text-ink-200"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-rose-500 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-rose-400 disabled:opacity-60"
    >
      {pending ? "Deleting…" : "Yes, delete it"}
    </button>
  );
}
