import { SOURCES, STATUSES, type Source, type Status } from './enums';
import { addDays, weekStart } from './dates';
import { daysToFirstResponse, hasResponded, isActive, isFollowUpDue, isStale, lastChangeDate } from './definitions';
import { buildSankey, type SankeyData } from './sankey';
import type { Application, DateRange, IsoDate, StatusEntry } from './schemas';

export type ActivityItem = { applicationId: string; company: string; role: string; entry: StatusEntry };
export type DashboardData = {
  activeCount: number;
  interviewCount: number;
  offerCount: number;
  responseRate: number | null;
  followUpsDue: Application[];
  stale: Application[];
  recentActivity: ActivityItem[];
};

const RECENT_ACTIVITY_LIMIT = 10;

const rate = (num: number, den: number): number | null => (den === 0 ? null : num / den);

export function computeDashboard(apps: Application[], today: IsoDate): DashboardData {
  const recentActivity = apps
    .flatMap((app) =>
      app.statusHistory.map((entry, index) => ({
        index,
        item: { applicationId: app.id, company: app.company, role: app.role, entry },
      })),
    )
    .sort(
      (a, b) =>
        b.item.entry.date.localeCompare(a.item.entry.date) ||
        b.index - a.index ||
        a.item.applicationId.localeCompare(b.item.applicationId),
    )
    .slice(0, RECENT_ACTIVITY_LIMIT)
    .map((x) => x.item);

  return {
    activeCount: apps.filter(isActive).length,
    interviewCount: apps.filter((a) => a.status === 'interview').length,
    offerCount: apps.filter((a) => a.status === 'offer').length,
    responseRate: rate(apps.filter(hasResponded).length, apps.length),
    followUpsDue: apps
      .filter((a) => isFollowUpDue(a, today))
      .sort((a, b) => a.followUpDate!.localeCompare(b.followUpDate!)),
    stale: apps.filter((a) => isStale(a, today)).sort((a, b) => lastChangeDate(a).localeCompare(lastChangeDate(b))),
    recentActivity,
  };
}

export const DAYS_BUCKETS = ['0–3', '4–7', '8–14', '15–30', '31+'] as const;
type DaysBucket = (typeof DAYS_BUCKETS)[number];

export type ReportData = {
  range: DateRange | null;
  total: number;
  responded: number;
  responseRate: number | null;
  statusBreakdown: { status: Status; count: number }[];
  bySource: { source: Source; count: number }[];
  perWeek: { weekStart: IsoDate; count: number }[];
  responseRateBySource: { source: Source; applications: number; responded: number; rate: number | null }[];
  daysToFirstResponse: { bucket: DaysBucket; count: number }[];
  medianDaysToFirstResponse: number | null;
  sankey: SankeyData;
};

function bucketFor(days: number): DaysBucket {
  if (days <= 3) return DAYS_BUCKETS[0];
  if (days <= 7) return DAYS_BUCKETS[1];
  if (days <= 14) return DAYS_BUCKETS[2];
  if (days <= 30) return DAYS_BUCKETS[3];
  return DAYS_BUCKETS[4];
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function perWeekCounts(apps: Application[], range?: DateRange): ReportData['perWeek'] {
  const dates = apps.map((a) => a.dateApplied).sort();
  const first = range ? range.from : dates[0];
  const last = range ? range.to : dates[dates.length - 1];
  if (first === undefined || last === undefined) return [];
  const counts = new Map<IsoDate, number>();
  for (const a of apps) {
    const w = weekStart(a.dateApplied);
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  const result: ReportData['perWeek'] = [];
  const end = weekStart(last);
  for (let w = weekStart(first); w <= end; w = addDays(w, 7)) {
    result.push({ weekStart: w, count: counts.get(w) ?? 0 });
  }
  return result;
}

export function computeReport(allApps: Application[], range?: DateRange): ReportData {
  const apps = range ? allApps.filter((a) => a.dateApplied >= range.from && a.dateApplied <= range.to) : allApps;
  const respondedApps = apps.filter(hasResponded);

  const statusBreakdown = STATUSES.map((status) => ({
    status,
    count: apps.filter((a) => a.status === status).length,
  })).filter((x) => x.count > 0);
  const bySource = SOURCES.map((source) => ({
    source,
    count: apps.filter((a) => a.source === source).length,
  })).filter((x) => x.count > 0);
  const responseRateBySource = bySource.map(({ source, count }) => {
    const responded = respondedApps.filter((a) => a.source === source).length;
    return { source, applications: count, responded, rate: rate(responded, count) };
  });

  const days = respondedApps.map((a) => daysToFirstResponse(a)).filter((d): d is number => d !== null);
  const histogram = DAYS_BUCKETS.map((bucket) => ({ bucket, count: 0 }));
  for (const d of days) histogram[DAYS_BUCKETS.indexOf(bucketFor(d))]!.count++;

  return {
    range: range ?? null,
    total: apps.length,
    responded: respondedApps.length,
    responseRate: rate(respondedApps.length, apps.length),
    statusBreakdown,
    bySource,
    perWeek: perWeekCounts(apps, range),
    responseRateBySource,
    daysToFirstResponse: histogram,
    medianDaysToFirstResponse: median(days),
    sankey: buildSankey(apps),
  };
}
