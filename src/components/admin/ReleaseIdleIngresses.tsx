"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { releaseIdleIngressesAction } from "@/actions/broadcasts";
import { emptyFormResultState } from "@/actions/form-state";

/**
 * Delete every LiveKit ingress not currently carrying a live broadcast.
 *
 * LiveKit meters an ingress for as long as it exists, so one left behind bills
 * around the clock. This is the only way to reach ingresses whose broadcast was
 * deleted — nothing else in the admin area can see them.
 */
export function ReleaseIdleIngresses({ count }: { count: number }) {
  const [state, formAction] = useActionState(releaseIdleIngressesAction, emptyFormResultState);
  const [confirming, setConfirming] = useState(false);

  if (count === 0) return null;

  return (
    <div className="mt-5 border-t border-ink-800 pt-5">
      {state.error && (
        <p
          role="alert"
          className="mb-3 rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
        >
          {state.error}
        </p>
      )}
      {state.success && (
        <p
          role="status"
          className="mb-3 rounded-md border border-flux-500/30 bg-flux-500/10 px-4 py-3 text-sm text-flux-200"
        >
          {state.success}
        </p>
      )}

      <p className="mb-3 text-xs leading-relaxed text-ink-400">
        LiveKit bills a stream destination for as long as it <em>exists</em>, not for the time
        an encoder is connected. Anything listed above is metering right now. Releasing stops
        the meter; a live broadcast is skipped, and any other stream URL and key stop working.
      </p>

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-md border border-rose-500/40 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-rose-200 transition hover:bg-rose-500/10"
        >
          Release idle destinations
        </button>
      ) : (
        <form action={formAction} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="confirm" value="release-idle" />
          <Confirm count={count} />
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-sm text-ink-400 transition hover:text-ink-200"
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}

function Confirm({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-rose-500 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-rose-400 disabled:opacity-60"
    >
      {pending ? "Releasing…" : `Yes, release all ${count} idle`}
    </button>
  );
}
