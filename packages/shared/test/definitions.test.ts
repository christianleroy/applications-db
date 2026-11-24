import { describe, expect, it } from 'vitest';
import { daysToFirstResponse, hasResponded, isActive, isFollowUpDue, isStale } from '../src/definitions';
import { addStatusEntry, createApplication } from '../src/history';
import type { Status } from '../src/enums';
import { NOW, ids } from './helpers';

function build(dateApplied: string, later: Array<[Status, string]> = [], followUpDate?: string) {
  let app = createApplication(
    { company: 'Acme', role: 'Dev', source: 'linkedin', dateApplied, contacts: [], followUpDate },
    ids(),
    NOW,
  );
  later.forEach(([status, date], i) => {
    app = addStatusEntry(app, { status, date }, ids(100 + i * 10), NOW);
  });
  return app;
}

describe('definitions', () => {
  it('isActive', () => {
    expect(isActive(build('2026-11-01', [['offer', '2026-11-10']]))).toBe(true);
    expect(isActive(build('2026-11-01', [['accepted', '2026-11-10']]))).toBe(false);
  });

  it('hasResponded', () => {
    expect(hasResponded(build('2026-11-01'))).toBe(false);
    expect(hasResponded(build('2026-11-01', [['ghosted', '2026-11-20']]))).toBe(false);
    expect(hasResponded(build('2026-11-01', [['screening', '2026-11-05'], ['withdrawn', '2026-11-06']]))).toBe(true);
  });

  it('daysToFirstResponse', () => {
    expect(daysToFirstResponse(build('2026-11-01', [['screening', '2026-11-08']]))).toBe(7);
    expect(daysToFirstResponse(build('2026-11-01'))).toBeNull();
  });

  it('isStale uses a 21-day threshold on active applications', () => {
    const app = build('2026-11-01');
    expect(isStale(app, '2026-11-22')).toBe(true);
    expect(isStale(app, '2026-11-21')).toBe(false);
    expect(isStale(app, '2026-11-11', 10)).toBe(true);
    expect(isStale(build('2026-09-01', [['rejected', '2026-09-02']]), '2026-11-01')).toBe(false);
  });

  it('isFollowUpDue', () => {
    const app = build('2026-11-01', [], '2026-11-23');
    expect(isFollowUpDue(app, '2026-11-23')).toBe(true);
    expect(isFollowUpDue(app, '2026-11-22')).toBe(false);
    expect(isFollowUpDue(build('2026-11-01'), '2026-11-23')).toBe(false);
    const accepted = build('2026-11-01', [['accepted', '2026-11-10']], '2026-11-23');
    expect(isFollowUpDue(accepted, '2026-11-23')).toBe(false);
  });
});
