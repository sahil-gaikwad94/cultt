/**
 * Calendar files — a saved concert or dinner becomes a real event.
 *
 * `eventIcs` is pure so the shape is pinned by a test: the one thing worse than
 * no reminder is a reminder at the wrong time. Times are emitted as floating
 * local time (`DTSTART;TZID`), which every calendar app resolves against the
 * device's own zone.
 */

export interface CalendarEvent {
  title: string;
  description: string;
  location: string;
  /** Local wall-clock start, `YYYY-MM-DDTHH:MM:SS`. */
  start: string;
  /** Minutes; defaults to two hours — a gig, not a meeting. */
  durationMinutes?: number;
  url?: string;
  /** Stable uid so re-saving updates the event instead of duplicating it. */
  uid: string;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** `2026-10-14T20:30:00` → `20261014T203000`. */
export const icsStamp = (local: string): string => local.replace(/[-:]/g, '').replace(/\.\d+/, '');

/** Adds minutes to a local wall-clock stamp, without timezone drift. */
export const addMinutes = (local: string, minutes: number): string => {
  const [datePart, timePart = '00:00:00'] = local.split('T');
  const [y, m, d] = (datePart ?? '').split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  const base = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0);
  base.setMinutes(base.getMinutes() + minutes);
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}T${pad(base.getHours())}:${pad(base.getMinutes())}:00`;
};

const escapeText = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Folds long lines at 75 octets, as RFC 5545 requires. */
const fold = (line: string): string => {
  if (line.length <= 73) return line;
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 73) {
    parts.push(rest.slice(0, 73));
    rest = ` ${rest.slice(73)}`;
  }
  parts.push(rest);
  return parts.join('\r\n');
};

export const eventIcs = (event: CalendarEvent, now = new Date()): string => {
  const end = addMinutes(event.start, event.durationMinutes ?? 120);
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//cultured//outing//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${escapeText(event.uid)}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${icsStamp(event.start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    `LOCATION:${escapeText(event.location)}`,
    ...(event.url ? [`URL:${escapeText(event.url)}`] : []),
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(event.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(fold).join('\r\n')}\r\n`;
};

/** Triggers the download. Returns the filename, so the toast can be truthful. */
export const downloadIcs = (filename: string, ics: string): string => {
  const name = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  try {
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch {
    /* Nothing to do; the caller keeps its "remind me" state either way. */
  }
  return name;
};
