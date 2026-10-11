/**
 * Calendar days are plain 'YYYY-MM-DD' strings everywhere. "Today" is decided by the
 * browser (the user's own clock), never by the server, so late-night logs land on the right day.
 */

const DAY_MS = 86_400_000;

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const todayISO = () => toISODate(new Date());

/** Parses at local noon so DST shifts can never move it to a neighbouring day. */
export function parseISODate(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y!, m! - 1, d!, 12);
}

export function addDays(day: string, n: number): string {
  const date = parseISODate(day);
  date.setDate(date.getDate() + n);
  return toISODate(date);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseISODate(to).getTime() - parseISODate(from).getTime()) / DAY_MS);
}

/** Every day from `from` to `to`, inclusive. */
export function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
}

export function startOfWeek(day: string): string {
  const date = parseISODate(day);
  const offset = (date.getDay() + 6) % 7; // Monday first
  return addDays(day, -offset);
}

export function ageOn(birthDate: string, day: string): number {
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [y, m, d] = day.split('-').map(Number);
  let age = y! - by!;
  if (m! < bm! || (m === bm && d! < bd!)) age--;
  return age;
}

export function formatDay(day: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }): string {
  return parseISODate(day).toLocaleDateString(undefined, opts);
}

/** "Today", "Yesterday", "Tomorrow" or a short date. */
export function relativeDay(day: string, today = todayISO()): string {
  const diff = daysBetween(today, day);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  return formatDay(day);
}

export function minutesToHM(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (!h) return `${rest}m`;
  return rest ? `${h}h ${rest}m` : `${h}h`;
}

/** Minutes after midnight of a timestamp in local time; small hours count as > 24h for bedtimes. */
export function clockMinutes(iso: string, { lateNight = false } = {}): number {
  const d = new Date(iso);
  const minutes = d.getHours() * 60 + d.getMinutes();
  return lateNight && minutes < 12 * 60 ? minutes + 24 * 60 : minutes;
}

export function formatClock(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const d = new Date(2000, 0, 1, Math.floor(m / 60), m % 60);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
