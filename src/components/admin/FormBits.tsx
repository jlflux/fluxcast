"use client";

import type { ReactNode } from "react";

/** Shared form primitives for the admin forms. */

export const inputClass =
  "w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2.5 text-sm text-ink-100 placeholder:text-ink-600 transition focus:border-flux-500";

export const labelClass = "text-sm font-semibold text-ink-200";

export function Field({
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
  children: ReactNode;
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

export function Hint({ children }: { children: ReactNode }) {
  return <p className="text-xs text-ink-400">{children}</p>;
}

export function RadioCard({
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
