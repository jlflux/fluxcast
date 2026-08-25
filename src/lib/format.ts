/**
 * Date/time formatting.
 *
 * Every time on the site is rendered in the school's local timezone rather than
 * the viewer's. Two reasons: a high-school game time means "7:00 PM in
 * Homewood" no matter where the fan is listening from, and pinning the zone
 * keeps server-rendered markup identical to the client's, so there is no
 * hydration mismatch. When FluxCast adds schools outside Central time this
 * becomes a per-school field.
 */
export const SITE_TIME_ZONE = "America/Chicago";

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: SITE_TIME_ZONE,
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: SITE_TIME_ZONE,
});

const longDayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: SITE_TIME_ZONE,
});

/** "Fri, Sep 5" */
export function formatDay(iso: string): string {
  return dayFormatter.format(new Date(iso));
}

/** "Friday, September 5" */
export function formatLongDay(iso: string): string {
  return longDayFormatter.format(new Date(iso));
}

/** "7:00 PM" */
export function formatTime(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

/** "Fri, Sep 5 · 7:00 PM" */
export function formatKickoff(iso: string): string {
  return `${formatDay(iso)} · ${formatTime(iso)}`;
}

/** True when the instant falls on today's date in the site timezone. */
export function isToday(iso: string, now: Date = new Date()): boolean {
  return dayFormatter.format(new Date(iso)) === dayFormatter.format(now);
}

/**
 * Offset, in milliseconds, between UTC and `timeZone` at a given instant.
 * Derived from Intl rather than a timezone library — this is the only place
 * FluxCast needs it.
 */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const lookup = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  // `Intl` renders hour 24 for midnight in some environments.
  const hour = lookup("hour") % 24;

  const asUtc = Date.UTC(
    lookup("year"),
    lookup("month") - 1,
    lookup("day"),
    hour,
    lookup("minute"),
    lookup("second"),
  );

  return asUtc - instant.getTime();
}

/**
 * Convert a wall-clock date and time in the site timezone into a UTC instant.
 *
 * The admin form collects "2026-09-05" and "19:00", which a person means as
 * 7pm in Homewood. Two passes settle the offset correctly on days when
 * daylight saving changes.
 *
 * @param date - `YYYY-MM-DD`
 * @param time - `HH:MM` (24-hour)
 * @returns ISO-8601 instant, or null if either field is malformed.
 */
export function wallTimeToIso(
  date: string,
  time: string,
  timeZone: string = SITE_TIME_ZONE,
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;

  const naive = new Date(`${date}T${time}:00Z`);
  if (Number.isNaN(naive.getTime())) return null;

  let instant = new Date(naive.getTime() - zoneOffsetMs(naive, timeZone));
  instant = new Date(naive.getTime() - zoneOffsetMs(instant, timeZone));

  return instant.toISOString();
}

/** Split an ISO instant back into `{ date, time }` in the site timezone. */
export function isoToWallTime(iso: string, timeZone: string = SITE_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`,
  };
}
