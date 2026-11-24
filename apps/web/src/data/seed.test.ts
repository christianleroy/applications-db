import { ApplicationSchema, SOURCES, STATUSES, computeDashboard, lastChangeDate } from '@applications-db/shared';
import { generateSeed } from './seed';

const TODAY = '2026-11-23';

describe('generateSeed', () => {
  const seed = generateSeed(TODAY);

  it('is deterministic', () => {
    expect(generateSeed(TODAY)).toEqual(seed);
  });

  it('produces the requested number of valid applications with unique ids', () => {
    expect(seed).toHaveLength(45);
    expect(generateSeed(TODAY, 12)).toHaveLength(12);
    for (const app of seed) expect(ApplicationSchema.safeParse(app).success).toBe(true);
    const ids = seed.flatMap((a) => [a.id, ...a.statusHistory.map((e) => e.id)]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers every status and source', () => {
    expect(new Set(seed.map((a) => a.status))).toEqual(new Set(STATUSES));
    expect(new Set(seed.map((a) => a.source))).toEqual(new Set(SOURCES));
  });

  it('keeps all dates within the 120 days up to today', () => {
    for (const app of seed) {
      expect(app.dateApplied <= TODAY).toBe(true);
      expect(app.dateApplied >= '2026-07-25').toBe(true);
      expect(lastChangeDate(app) <= TODAY).toBe(true);
      if (app.followUpDate) expect(app.followUpDate.length).toBe(10);
    }
  });

  it('includes some follow-ups due and stale applications', () => {
    const d = computeDashboard(seed, TODAY);
    expect(d.followUpsDue.length).toBeGreaterThanOrEqual(3);
    expect(d.stale.length).toBeGreaterThanOrEqual(2);
  });

  it('includes contacts, notes and salaries on some items', () => {
    expect(seed.some((a) => a.contacts.length > 0)).toBe(true);
    expect(seed.some((a) => a.notes)).toBe(true);
    expect(seed.some((a) => a.salary)).toBe(true);
  });
});
