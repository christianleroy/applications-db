import { describe, expect, it } from 'vitest';
import { addStatusEntry, createApplication } from '../src/history';
import { addDays } from '../src/dates';
import { computeDashboard, computeReport } from '../src/stats';
import type { Source, Status } from '../src/enums';
import type { Application } from '../src/schemas';
import { NOW, ids } from './helpers';

const gen = ids(3000);
type Step = [Status, string];
const make = (source: Source, dateApplied: string, steps: Step[] = [], followUpDate?: string): Application => {
  let app = createApplication(
    { company: 'Acme', role: 'Dev', source, dateApplied, contacts: [], followUpDate },
    gen,
    NOW,
  );
  for (const [status, date] of steps) app = addStatusEntry(app, { status, date }, gen, NOW);
  return app;
};

describe('computeReport', () => {
  it('handles empty input', () => {
    const r = computeReport([]);
    expect(r.range).toBeNull();
    expect(r.total).toBe(0);
    expect(r.responseRate).toBeNull();
    expect(r.medianDaysToFirstResponse).toBeNull();
    expect(r.perWeek).toEqual([]);
    expect(r.daysToFirstResponse).toHaveLength(5);
    expect(r.daysToFirstResponse.map((b) => b.count)).toEqual([0, 0, 0, 0, 0]);
    expect(r.sankey).toEqual({ nodes: [], links: [] });
  });

  it('computes response rates overall and by source', () => {
    const apps = [
      make('linkedin', '2026-11-01', [['screening', '2026-11-03']]),
      make('linkedin', '2026-11-01', [['ghosted', '2026-11-20']]),
      make('referral', '2026-11-01', [['interview', '2026-11-02']]),
      make('indeed', '2026-11-01'),
    ];
    const r = computeReport(apps);
    expect(r.responded).toBe(2);
    expect(r.responseRate).toBe(0.5);
    const by = Object.fromEntries(r.responseRateBySource.map((x) => [x.source, x.rate]));
    expect(by).toEqual({ linkedin: 0.5, indeed: 0, referral: 1 });
    expect(r.bySource.map((x) => x.source)).toEqual(['linkedin', 'indeed', 'referral']);
    expect(r.statusBreakdown).toEqual([
      { status: 'applied', count: 1 },
      { status: 'screening', count: 1 },
      { status: 'interview', count: 1 },
      { status: 'ghosted', count: 1 },
    ]);
  });

  it('filters by inclusive range and zero-fills weeks', () => {
    const apps = [make('linkedin', '2026-11-01'), make('linkedin', '2026-11-03'), make('linkedin', '2026-11-12')];
    const r = computeReport(apps, { from: '2026-11-02', to: '2026-11-15' });
    expect(r.total).toBe(2);
    expect(r.range).toEqual({ from: '2026-11-02', to: '2026-11-15' });
    expect(r.perWeek).toEqual([
      { weekStart: '2026-11-02', count: 1 },
      { weekStart: '2026-11-09', count: 1 },
    ]);
  });

  it('zero-fills gaps between data weeks without a range', () => {
    const r = computeReport([make('other', '2026-11-03'), make('other', '2026-11-24')]);
    expect(r.perWeek.map((w) => w.count)).toEqual([1, 0, 0, 1]);
  });

  it('buckets days to first response and takes the median', () => {
    const resp = (days: number) => make('other', '2026-10-01', [['screening', addDays('2026-10-01', days)]]);
    const r = computeReport([resp(3), resp(4), resp(31)]);
    expect(r.daysToFirstResponse).toEqual([
      { bucket: '0–3', count: 1 },
      { bucket: '4–7', count: 1 },
      { bucket: '8–14', count: 0 },
      { bucket: '15–30', count: 0 },
      { bucket: '31+', count: 1 },
    ]);
    expect(r.medianDaysToFirstResponse).toBe(4);
  });

  it('averages the two middle values for an even count', () => {
    const resp = (days: number) => make('other', '2026-10-01', [['screening', addDays('2026-10-01', days)]]);
    expect(computeReport([resp(2), resp(5), resp(9), resp(20)]).medianDaysToFirstResponse).toBe(7);
  });
});

describe('computeDashboard', () => {
  const today = '2026-11-23';
  it('computes counts, follow-ups, stale and recent activity', () => {
    const apps = [
      make('linkedin', '2026-11-01'),
      make('referral', '2026-11-01', [['interview', '2026-11-10']], '2026-11-20'),
      make('indeed', '2026-11-01', [['offer', '2026-11-15']], '2026-11-10'),
      make('indeed', '2026-11-01', [['rejected', '2026-11-05']], '2026-11-02'),
    ];
    const d = computeDashboard(apps, today);
    expect(d.activeCount).toBe(3);
    expect(d.interviewCount).toBe(1);
    expect(d.offerCount).toBe(1);
    expect(d.responseRate).toBe(0.75);
    expect(d.followUpsDue.map((a) => a.followUpDate)).toEqual(['2026-11-10', '2026-11-20']);
    expect(d.stale.map((a) => a.status)).toEqual(['applied']);
    expect(d.recentActivity.length).toBeLessThanOrEqual(10);
    const dates = d.recentActivity.map((i) => i.entry.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it('caps recent activity at 10 and handles no apps', () => {
    const many = Array.from({ length: 12 }, (_, i) => make('other', `2026-11-${String(i + 1).padStart(2, '0')}`));
    expect(computeDashboard(many, today).recentActivity).toHaveLength(10);
    expect(computeDashboard([], today).responseRate).toBeNull();
  });
});
