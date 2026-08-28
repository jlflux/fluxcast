/**
 * A stable, opaque identifier for this device on this broadcast.
 *
 * Exists so audience counts mean something. Without it every reconnect and
 * page reload would look like a new listener, and a fan with a flaky signal
 * would inflate the count tenfold.
 *
 * It is a random value scoped to one broadcast, kept in localStorage. It
 * identifies nothing about the person, is never sent anywhere but FluxCast, and
 * is worthless outside the row it keys. Clearing site data resets it, which
 * means the same person may be counted twice — the number is devices, not
 * people, and the admin report says so.
 */
export function getListenerKey(slug: string): string {
  const storageKey = `fluxcast:listener:${slug}`;

  try {
    const existing = window.localStorage.getItem(storageKey);
    if (existing) return existing;
    const created = randomKey();
    window.localStorage.setItem(storageKey, created);
    return created;
  } catch {
    // Private browsing, or storage disabled. A per-session key still stops a
    // single reconnect storm from counting as many listeners.
    return randomKey();
  }
}

function randomKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `k-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}
