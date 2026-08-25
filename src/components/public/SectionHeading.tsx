import type { ReactNode } from "react";

/** Section eyebrow used across the public site: LIVE NOW, UPCOMING, and so on. */
export function SectionHeading({
  children,
  accent = false,
  count,
}: {
  children: ReactNode;
  accent?: boolean;
  count?: number;
}) {
  return (
    <div className="mb-4 flex items-baseline gap-3">
      <h2
        className={`headline text-xl sm:text-2xl ${accent ? "text-live" : "text-ink-100"}`}
      >
        {children}
      </h2>
      {count !== undefined && count > 0 && (
        <span className="eyebrow text-ink-400">
          {count} {count === 1 ? "game" : "games"}
        </span>
      )}
      <span className="h-px flex-1 bg-ink-800" aria-hidden />
    </div>
  );
}
