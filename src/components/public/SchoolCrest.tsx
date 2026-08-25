import type { School } from "@/lib/types";

const SIZES = {
  sm: "size-10 text-sm rounded-lg",
  md: "size-14 text-lg rounded-xl",
  lg: "size-20 sm:size-24 text-2xl sm:text-3xl rounded-2xl",
} as const;

/**
 * School logo placeholder.
 *
 * Renders the school's initials on its primary colour until a real logo is
 * uploaded. Once `logoUrl` is populated this becomes an <img>.
 */
export function SchoolCrest({
  school,
  size = "md",
}: {
  school: School;
  size?: keyof typeof SIZES;
}) {
  const initials = school.shortName
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center font-extrabold tracking-tight text-white ring-1 ring-inset ring-white/15 ${SIZES[size]}`}
      style={{ backgroundColor: school.primaryColor ?? "#232837" }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
