import type { IdGen } from '../src/history';

export const NOW = '2026-11-23T10:00:00.000Z';
export const ids = (start = 1): IdGen => {
  let n = start;
  return () => `id-${n++}`;
};
