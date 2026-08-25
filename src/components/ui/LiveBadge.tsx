/**
 * The on-air indicator. Red is reserved for this component and nothing else.
 */
export function LiveBadge({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const styles = {
    sm: "gap-1.5 px-2 py-0.5 text-[10px]",
    md: "gap-2 px-2.5 py-1 text-xs",
    lg: "gap-2.5 px-3.5 py-1.5 text-sm",
  } as const;

  const dot = {
    sm: "size-1.5",
    md: "size-2",
    lg: "size-2.5",
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-full bg-live/15 font-bold uppercase tracking-[0.16em] text-live ring-1 ring-inset ring-live/40 ${styles[size]}`}
    >
      <span className={`${dot[size]} animate-live-pulse rounded-full bg-live`} aria-hidden />
      Live
    </span>
  );
}
