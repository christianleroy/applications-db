import type { IsoDate } from '@applications-db/shared';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(d: IsoDate): string {
  const [y, m, day] = d.split('-').map(Number);
  const month = MONTHS[(m ?? 1) - 1];
  if (!y || !month || !day) return d;
  return `${month} ${day}, ${y}`;
}

export function formatPercent(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`;
}
