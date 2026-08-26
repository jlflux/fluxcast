"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { createSchoolAction } from "@/actions/broadcasts";
import { emptyFormResultState } from "@/actions/form-state";
import { Field, Hint, inputClass } from "@/components/admin/FormBits";

export function CreateSchoolForm() {
  const [state, formAction] = useActionState(createSchoolAction, emptyFormResultState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
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

      <Field label="School name" htmlFor="name" error={state.fieldErrors.name}>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="Vestavia Hills High School"
          className={inputClass}
        />
        <Hint>The public address is derived from this, e.g. /schools/vestavia-hills-high-school.</Hint>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Short name" htmlFor="shortName" optional>
          <input
            id="shortName"
            name="shortName"
            type="text"
            placeholder="Vestavia Hills"
            className={inputClass}
          />
          <Hint>Used in matchups: &ldquo;Vestavia Hills vs. Hoover&rdquo;.</Hint>
        </Field>

        <Field label="Mascot" htmlFor="mascot" optional>
          <input id="mascot" name="mascot" type="text" placeholder="Rebels" className={inputClass} />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="City" htmlFor="city" optional>
          <input id="city" name="city" type="text" placeholder="Vestavia Hills" className={inputClass} />
        </Field>
        <Field label="State" htmlFor="state" optional>
          <input id="state" name="state" type="text" placeholder="Alabama" className={inputClass} />
        </Field>
      </div>

      <Field label="Primary colour" htmlFor="primaryColor" optional>
        <input
          id="primaryColor"
          name="primaryColor"
          type="text"
          placeholder="#B3262F"
          className={inputClass}
        />
        <Hint>Hex colour used for the school crest placeholder.</Hint>
      </Field>

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start rounded-md bg-flux-400 px-5 py-3 text-sm font-bold uppercase tracking-wide text-ink-950 transition hover:bg-flux-300 disabled:opacity-60"
    >
      {pending ? "Creating…" : "Create school"}
    </button>
  );
}
