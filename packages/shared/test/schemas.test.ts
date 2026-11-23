import { describe, expect, it } from 'vitest';
import {
  ApplicationQuerySchema,
  CreateApplicationInputSchema,
  DateRangeSchema,
  IsoDateSchema,
  SalarySchema,
} from '../src/index';

describe('schemas', () => {
  it('accepts a minimal create input and defaults contacts', () => {
    const r = CreateApplicationInputSchema.parse({ company: 'Acme', role: 'Dev', source: 'linkedin', dateApplied: '2026-11-01' });
    expect(r.contacts).toEqual([]);
  });
  it('rejects blank company and role with required messages', () => {
    const r = CreateApplicationInputSchema.safeParse({ company: '  ', role: '', source: 'linkedin', dateApplied: '2026-11-01' });
    expect(r.success).toBe(false);
    const msgs = r.error!.issues.map((i) => i.message);
    expect(msgs).toContain('Company is required');
    expect(msgs).toContain('Role is required');
  });
  it('rejects impossible dates', () => {
    expect(IsoDateSchema.safeParse('2026-02-30').success).toBe(false);
    expect(IsoDateSchema.safeParse('2026-11-1').success).toBe(false);
  });
  it('rejects salary min > max on the max field', () => {
    const r = SalarySchema.safeParse({ min: 100, max: 50, currency: 'EUR', period: 'year' });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0]!.path).toEqual(['max']);
    expect(r.error!.issues[0]!.message).toBe('Max must be at least min');
  });
  it('rejects a non-URL postingUrl', () => {
    expect(CreateApplicationInputSchema.safeParse({ company: 'A', role: 'B', source: 'other', dateApplied: '2026-11-01', postingUrl: 'not a url' }).success).toBe(false);
  });
  it('applies query defaults', () => {
    expect(ApplicationQuerySchema.parse({})).toMatchObject({ sort: 'dateApplied:desc', page: 1, pageSize: 25 });
  });
  it('rejects an inverted date range', () => {
    expect(DateRangeSchema.safeParse({ from: '2026-11-10', to: '2026-11-01' }).success).toBe(false);
  });
});
