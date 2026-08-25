"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { TeamOption } from "@/lib/data/source";
import { createBroadcastAction } from "@/actions/broadcasts";
import { emptyCreateBroadcastState } from "@/actions/form-state";

/**
 * Create-broadcast form.
 *
 * Homewood is the only school in the prototype, so the team is preselected. The
 * sport comes from the team rather than being chosen separately — a team *is* a
 * school plus a sport plus a level, and offering an independent sport dropdown
 * would let an operator pick a combination that does not exist.
 */
export function BroadcastForm({
  teams,
  defaultDate,
}: {
  teams: TeamOption[];
  defaultDate: string;
}) {
  const [state, formAction] = useActionState(
    createBroadcastAction,
    emptyCreateBroadcastState,
  );

  const only = teams.length === 1 ? teams[0] : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.error && (
        <p
          role="alert"
          className="rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
        >
          {state.error}
        </p>
      )}

      <Field label="Team" htmlFor="teamId" error={state.fieldErrors.teamId}>
        <select
          id="teamId"
          name="teamId"
          defaultValue={only?.id ?? ""}
          required
          className={inputClass}
        >
          {!only && <option value="">Select a team…</option>}
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.label}
            </option>
          ))}
        </select>
        <Hint>
          {only
            ? `Sport is set by the team (${only.sportName}).`
            : "Sport and level come from the team you pick."}
        </Hint>
      </Field>

      <Field label="Opponent" htmlFor="opponentName" error={state.fieldErrors.opponentName}>
        <input
          id="opponentName"
          name="opponentName"
          type="text"
          required
          autoComplete="off"
          placeholder="Mountain Brook"
          className={inputClass}
        />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className={labelClass}>Home or away</legend>
        <div className="flex gap-2">
          <RadioCard name="homeAway" value="home" label="Home" defaultChecked />
          <RadioCard name="homeAway" value="away" label="Away" />
        </div>
        <Hint>Sets whether the matchup reads &ldquo;vs.&rdquo; or &ldquo;at&rdquo;.</Hint>
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Date" htmlFor="date" error={state.fieldErrors.date}>
          <input
            id="date"
            name="date"
            type="date"
            required
            defaultValue={defaultDate}
            className={inputClass}
          />
        </Field>

        <Field label="Start time" htmlFor="time" error={state.fieldErrors.time}>
          <input
            id="time"
            name="time"
            type="time"
            required
            defaultValue="19:00"
            className={inputClass}
          />
          <Hint>Central time.</Hint>
        </Field>
      </div>

      <Field label="Location" htmlFor="location" optional>
        <input
          id="location"
          name="location"
          type="text"
          autoComplete="off"
          placeholder="Waldrop Stadium, Homewood, AL"
          className={inputClass}
        />
      </Field>

      <Field label="Broadcast title" htmlFor="title" optional>
        <input
          id="title"
          name="title"
          type="text"
          autoComplete="off"
          placeholder="Leave blank to use the matchup"
          className={inputClass}
        />
      </Field>

      <SubmitButton />
    </form>
  );
}

const inputClass =
  "w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2.5 text-sm text-ink-100 placeholder:text-ink-600 transition focus:border-flux-500";

const labelClass = "text-sm font-semibold text-ink-200";

function Field({
  label,
  htmlFor,
  error,
  optional,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
        {optional && <span className="ml-1.5 font-normal text-ink-500">optional</span>}
      </label>
      {children}
      {error && <p className="text-xs text-rose-300">{error}</p>}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-ink-400">{children}</p>;
}

function RadioCard({
  name,
  value,
  label,
  defaultChecked,
}: {
  name: string;
  value: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex-1 cursor-pointer">
      <input
        type="radio"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <span className="block rounded-md border border-ink-700 bg-ink-950 px-3 py-2.5 text-center text-sm font-semibold text-ink-300 transition peer-checked:border-flux-500 peer-checked:bg-flux-500/10 peer-checked:text-flux-300 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-flux-400">
        {label}
      </span>
    </label>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-flux-400 px-5 py-3 text-sm font-bold uppercase tracking-wide text-ink-950 transition hover:bg-flux-300 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Creating…" : "Create Broadcast"}
    </button>
  );
}
