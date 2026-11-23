import { describe, expect, it } from 'vitest';
import { addDays, diffDays, todayIso, weekStart } from '../src/dates';
import { DomainError } from '../src/errors';

describe('dates', () => {
  it('todayIso uses the local date, not UTC', () => {
    const lateEvening = new Date(2026, 10, 23, 23, 30); // local 23:30
    expect(todayIso(lateEvening)).toBe('2026-11-23');
  });
  it('addDays crosses month and year', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('diffDays is DST-safe', () => {
    expect(diffDays('2026-03-30', '2026-03-28')).toBe(2);
    expect(diffDays('2026-11-02', '2026-10-31')).toBe(2);
  });
  it('weekStart returns Monday', () => {
    expect(weekStart('2026-11-23')).toBe('2026-11-23'); // Monday
    expect(weekStart('2026-11-29')).toBe('2026-11-23'); // Sunday
  });
});

describe('DomainError', () => {
  it('carries a code and is an Error', () => {
    const e = new DomainError('ENTRY_NOT_FOUND', 'nope');
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe('ENTRY_NOT_FOUND');
    expect(e.message).toBe('nope');
  });
});
