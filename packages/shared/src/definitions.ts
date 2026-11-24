import { ACTIVE_STATUSES, NON_RESPONSE_STATUSES } from './enums';
import { diffDays } from './dates';
import type { Application, IsoDate, StatusEntry } from './schemas';

const isIn = (list: readonly string[], s: string) => list.includes(s);

export function isActive(app: Application): boolean {
  return isIn(ACTIVE_STATUSES, app.status);
}

export function firstResponseEntry(app: Application): StatusEntry | undefined {
  return app.statusHistory.find((e) => !isIn(NON_RESPONSE_STATUSES, e.status));
}

export function hasResponded(app: Application): boolean {
  return firstResponseEntry(app) !== undefined;
}

export function daysToFirstResponse(app: Application): number | null {
  const entry = firstResponseEntry(app);
  return entry ? diffDays(entry.date, app.dateApplied) : null;
}

export function lastChangeDate(app: Application): IsoDate {
  return app.statusHistory[app.statusHistory.length - 1]!.date;
}

export function isStale(app: Application, today: IsoDate, thresholdDays = 21): boolean {
  return isActive(app) && diffDays(today, lastChangeDate(app)) >= thresholdDays;
}

export function isFollowUpDue(app: Application, today: IsoDate): boolean {
  return isActive(app) && app.followUpDate !== undefined && app.followUpDate <= today;
}
