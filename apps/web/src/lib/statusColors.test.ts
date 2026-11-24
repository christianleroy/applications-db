import { describe, expect, it } from 'vitest';
import { SOURCES, STATUSES } from '@applications-db/shared';
import { SOURCE_COLORS, STATUS_COLORS } from './statusColors';

const MAROON = '#7b1e2e';

describe('statusColors', () => {
  it('has an entry with a hex and a badge class for every status', () => {
    for (const s of STATUSES) {
      expect(STATUS_COLORS[s].hex).toMatch(/^#[0-9a-f]{6}$/i);
      expect(STATUS_COLORS[s].badgeClass).not.toBe('');
    }
  });

  it('uses 8 distinct status hex values, none of them the maroon primary', () => {
    const hexes = STATUSES.map((s) => STATUS_COLORS[s].hex.toLowerCase());
    expect(new Set(hexes).size).toBe(8);
    expect(hexes).not.toContain(MAROON);
  });

  it('has a colour for every source, none of them the maroon primary', () => {
    for (const s of SOURCES) {
      expect(SOURCE_COLORS[s]).toMatch(/^#[0-9a-f]{6}$/i);
      expect(SOURCE_COLORS[s].toLowerCase()).not.toBe(MAROON);
    }
  });
});
