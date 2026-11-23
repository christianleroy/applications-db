import type { IsoDate } from './schemas';

const MS_PER_DAY = 86_400_000;

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

function toUtcMs(d: IsoDate): number {
  const [y = 0, m = 1, day = 1] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, day);
}

function fromUtcMs(ms: number): IsoDate {
  const dt = new Date(ms);
  return `${pad(dt.getUTCFullYear(), 4)}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Local calendar date of `now`. */
export function todayIso(now: Date = new Date()): IsoDate {
  return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function addDays(d: IsoDate, n: number): IsoDate {
  return fromUtcMs(toUtcMs(d) + n * MS_PER_DAY);
}

/** Whole days from `earlier` to `later`; computed on UTC midnights so DST cannot skew it. */
export function diffDays(later: IsoDate, earlier: IsoDate): number {
  return Math.round((toUtcMs(later) - toUtcMs(earlier)) / MS_PER_DAY);
}

/** Monday of the ISO week containing `d`. */
export function weekStart(d: IsoDate): IsoDate {
  const dow = new Date(toUtcMs(d)).getUTCDay(); // 0 = Sunday
  return addDays(d, -((dow + 6) % 7));
}
