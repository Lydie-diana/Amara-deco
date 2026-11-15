/**
 * Dates à l'heure du Cameroun (Africa/Douala, UTC+1 toute l'année, sans heure d'été).
 * Les jours sont des chaînes AAAA-MM-JJ, comme la base les attend.
 */
export const CAMEROON_TIME_ZONE = 'Africa/Douala';
const OFFSET_MS = 60 * 60 * 1000;
const DAY_MS = 24 * OFFSET_MS;

/** Le jour (AAAA-MM-JJ) au Cameroun pour un instant donné. */
export function cameroonDay(at: Date = new Date()): string {
  return new Date(at.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** Les `count` prochains jours au Cameroun, à partir d'aujourd'hui. */
export function upcomingDays(count: number, from: Date = new Date()): string[] {
  const start = Date.parse(`${cameroonDay(from)}T00:00:00Z`);
  return Array.from({ length: count }, (_, i) =>
    new Date(start + i * DAY_MS).toISOString().slice(0, 10),
  );
}

function format(at: Date, locale: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', {
    timeZone: CAMEROON_TIME_ZONE,
    ...options,
  }).format(at);
}

/** « lun. 17 nov. » */
export function formatDay(day: string, locale: string): string {
  return format(new Date(`${day}T12:00:00+01:00`), locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** « 10:30 » */
export function formatTime(iso: string, locale: string): string {
  return format(new Date(iso), locale, { hour: '2-digit', minute: '2-digit' });
}

/** « lundi 17 novembre, 10:30 » */
export function formatDateTime(iso: string, locale: string): string {
  return format(new Date(iso), locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Instant ISO d'une heure locale camerounaise (« 2026-11-17 », « 10:30 »). */
export function cameroonInstant(day: string, time: string): string {
  return new Date(`${day}T${time}:00+01:00`).toISOString();
}
