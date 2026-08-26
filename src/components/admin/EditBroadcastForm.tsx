"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { BroadcastView } from "@/lib/types";
import { updateBroadcastAction } from "@/actions/broadcasts";
import { emptyFormResultState } from "@/actions/form-state";
import { Field, Hint, RadioCard, inputClass, labelClass } from "@/components/admin/FormBits";

/**
 * Correct an existing broadcast.
 *
 * The public URL is intentionally not editable: it may already have been
 * shared, and fixing a typo should not break someone's link.
 */
export function EditBroadcastForm({
  broadcast,
  date,
  time,
}: {
  broadcast: BroadcastView;
  /** Kickoff split into site-timezone wall clock by the server. */
  date: string;
  time: string;
}) {
  const [state, formAction] = useActionState(updateBroadcastAction, emptyFormResultState);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="broadcastId" value={broadcast.id} />

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

      <Field label="Opponent" htmlFor="opponentName" error={state.fieldErrors.opponentName}>
        <input
          id="opponentName"
          name="opponentName"
          type="text"
          required
          defaultValue={broadcast.opponentName}
          className={inputClass}
        />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className={labelClass}>Home or away</legend>
        <div className="flex gap-2">
          <RadioCard name="homeAway" value="home" label="Home" defaultChecked={broadcast.isHome} />
          <RadioCard
            name="homeAway"
            value="away"
            label="Away"
            defaultChecked={!broadcast.isHome}
          />
        </div>
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Date" htmlFor="date" error={state.fieldErrors.date}>
          <input id="date" name="date" type="date" required defaultValue={date} className={inputClass} />
        </Field>
        <Field label="Start time" htmlFor="time" error={state.fieldErrors.time}>
          <input id="time" name="time" type="time" required defaultValue={time} className={inputClass} />
          <Hint>Central time.</Hint>
        </Field>
      </div>

      <Field label="Location" htmlFor="location" optional>
        <input
          id="location"
          name="location"
          type="text"
          defaultValue={broadcast.location ?? ""}
          className={inputClass}
        />
      </Field>

      <Field label="Broadcast title" htmlFor="title" optional>
        <input
          id="title"
          name="title"
          type="text"
          defaultValue={broadcast.title}
          className={inputClass}
        />
        <Hint>Leave blank to use the matchup.</Hint>
      </Field>

      <div className="rounded-md border border-ink-800 bg-ink-950 px-3 py-2.5">
        <p className="text-xs text-ink-400">
          Public link stays{" "}
          <code className="font-mono text-ink-300">/broadcasts/{broadcast.slug}</code> — it is
          not regenerated, so any link already shared keeps working.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton />
        <Link
          href={`/admin/broadcasts/${broadcast.id}`}
          className="text-sm text-ink-400 transition hover:text-ink-200"
        >
          Back
        </Link>
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-flux-400 px-5 py-3 text-sm font-bold uppercase tracking-wide text-ink-950 transition hover:bg-flux-300 disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}
