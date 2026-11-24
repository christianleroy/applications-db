import { describe, expect, it } from 'vitest';
import { formatDate, formatPercent } from './format';

describe('format', () => {
  it('formats dates from parts, independent of timezone', () => {
    expect(formatDate('2026-11-23')).toBe('Nov 23, 2026');
    expect(formatDate('2026-01-01')).toBe('Jan 1, 2026');
  });
  it('formats percents', () => {
    expect(formatPercent(null)).toBe('—');
    expect(formatPercent(0.5)).toBe('50%');
    expect(formatPercent(0)).toBe('0%');
  });
});
