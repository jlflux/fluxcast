"use client";

import { useState } from "react";

import { CopyButton } from "@/components/ui/CopyButton";

/**
 * A value that is masked until the operator asks to see it.
 *
 * Used for the LiveKit stream key so it is not exposed on a shared screen or in
 * a screenshot by default. Copy works without revealing.
 */
export function SecretField({ value, id }: { value: string; id?: string }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <code
        id={id}
        className="min-w-0 flex-1 overflow-x-auto rounded-md border border-ink-700 bg-ink-950 px-3 py-2 font-mono text-sm text-ink-100"
      >
        {revealed ? value : "•".repeat(Math.min(value.length, 40))}
      </code>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          className="inline-flex items-center rounded-md border border-ink-700 bg-ink-800 px-3 py-1.5 text-xs font-semibold text-ink-200 transition hover:border-ink-600 hover:bg-ink-700"
          aria-pressed={revealed}
        >
          {revealed ? "Hide" : "Reveal"}
        </button>
        <CopyButton value={value} />
      </div>
    </div>
  );
}
