import Link from "next/link";

/**
 * Temporary text-only FluxCast wordmark.
 *
 * Deliberately not a designed logo — this is a placeholder that reads correctly
 * at any size and costs nothing to replace later.
 */
export function Wordmark({
  size = "md",
  href = "/",
}: {
  size?: "sm" | "md" | "lg";
  href?: string | null;
}) {
  const sizes = {
    sm: "text-lg",
    md: "text-xl sm:text-2xl",
    lg: "text-3xl sm:text-4xl",
  } as const;

  const mark = (
    <span className={`headline ${sizes[size]} tracking-[-0.04em]`}>
      <span className="text-ink-100">FLUX</span>
      <span className="text-flux-400">CAST</span>
    </span>
  );

  if (!href) return mark;

  return (
    <Link href={href} className="inline-flex items-center" aria-label="FluxCast home">
      {mark}
    </Link>
  );
}
