"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { School, Sport } from "@/lib/types";
import { createTeamAction } from "@/actions/broadcasts";
import { emptyFormResultState } from "@/actions/form-state";
import { Field, Hint, inputClass } from "@/components/admin/FormBits";

export function CreateTeamForm({
  schools,
  sports,
  defaultSchoolId,
  lockedToSchool,
}: {
  schools: School[];
  sports: Sport[];
  defaultSchoolId: string | null;
  /** School admins cannot pick another school. */
  lockedToSchool: boolean;
}) {
  const [state, formAction] = useActionState(createTeamAction, emptyFormResultState);

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

      <Field label="School" htmlFor="schoolId" error={state.fieldErrors.schoolId}>
        {lockedToSchool && defaultSchoolId ? (
          <>
            <input type="hidden" name="schoolId" value={defaultSchoolId} />
            <p className="rounded-md border border-ink-800 bg-ink-950 px-3 py-2.5 text-sm text-ink-300">
              {schools.find((s) => s.id === defaultSchoolId)?.name ?? "Your school"}
            </p>
          </>
        ) : (
          <select
            id="schoolId"
            name="schoolId"
            required
            defaultValue={defaultSchoolId ?? ""}
            className={inputClass}
          >
            <option value="">Select a school…</option>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field label="Sport" htmlFor="sportId" error={state.fieldErrors.sportId}>
        <select
          id="sportId"
          name="sportId"
          required
          defaultValue={sports[0]?.id ?? ""}
          className={inputClass}
        >
          {sports.map((sport) => (
            <option key={sport.id} value={sport.id}>
              {sport.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Level" htmlFor="level">
          <select id="level" name="level" defaultValue="Varsity" className={inputClass}>
            <option>Varsity</option>
            <option>Junior Varsity</option>
            <option>Freshman</option>
          </select>
        </Field>

        <Field label="Team" htmlFor="gender">
          <select id="gender" name="gender" defaultValue="boys" className={inputClass}>
            <option value="boys">Boys</option>
            <option value="girls">Girls</option>
            <option value="">Coed / not applicable</option>
          </select>
          <Hint>Keeps boys&rsquo; and girls&rsquo; teams separate in the same sport.</Hint>
        </Field>
      </div>

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
      {pending ? "Creating…" : "Create team"}
    </button>
  );
}
