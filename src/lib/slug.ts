/** URL-safe slug: "Mountain Brook" -> "mountain-brook". */
export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * "homewood-vs-mountain-brook" / "homewood-at-vestavia-hills".
 * Mirrors how the matchup reads on screen so the URL is guessable.
 */
export function buildBroadcastSlug(
  schoolShortName: string,
  opponentName: string,
  isHome: boolean,
): string {
  return slugify(`${schoolShortName} ${isHome ? "vs" : "at"} ${opponentName}`);
}

/** "Homewood vs. Mountain Brook" / "Homewood at Vestavia Hills". */
export function buildMatchup(
  schoolShortName: string,
  opponentName: string,
  isHome: boolean,
): string {
  return isHome
    ? `${schoolShortName} vs. ${opponentName}`
    : `${schoolShortName} at ${opponentName}`;
}

/**
 * A LiveKit room name for a broadcast. Prefixed and suffixed with a random
 * segment so room names are neither guessable nor reused between broadcasts of
 * the same matchup.
 */
export function buildRoomName(broadcastSlug: string): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `fluxcast-${broadcastSlug}-${suffix}`.slice(0, 100);
}
