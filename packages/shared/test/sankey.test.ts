import { describe, expect, it } from 'vitest';
import { addStatusEntry, createApplication } from '../src/history';
import { buildSankey, forwardPath } from '../src/sankey';
import type { Application, Status } from '../src/schemas';
import { NOW, ids } from './helpers';

const gen = ids(2000);
const fixture = (statuses: Status[]): Application => {
  let app = createApplication(
    { company: 'Acme', role: 'Dev', source: 'linkedin', dateApplied: '2026-11-01', contacts: [] },
    gen,
    NOW,
  );
  statuses.slice(1).forEach((status, i) => {
    app = addStatusEntry(app, { status, date: `2026-11-${String(i + 2).padStart(2, '0')}` }, gen, NOW);
  });
  return app;
};

describe('forwardPath', () => {
  it.each<[string, Status[], string[]]>([
    ['no response', ['applied'], ['applied', 'no_response']],
    ['skipped stage', ['applied', 'interview'], ['applied', 'interview']],
    [
      'repeats and backwards',
      ['applied', 'screening', 'interview', 'screening', 'interview', 'offer'],
      ['applied', 'screening', 'interview', 'offer'],
    ],
    ['rejected', ['applied', 'screening', 'rejected'], ['applied', 'screening', 'rejected']],
    ['ghosted', ['applied', 'ghosted'], ['applied', 'ghosted']],
    ['went backwards, current screening', ['applied', 'interview', 'screening'], ['applied', 'interview']],
  ])('%s', (_n, statuses, expected) => {
    expect(forwardPath(fixture(statuses))).toEqual(expected);
  });
});

describe('buildSankey', () => {
  it('counts consecutive pairs with ordered nodes and links', () => {
    const data = buildSankey([fixture(['applied']), fixture(['applied', 'screening', 'rejected'])]);
    expect(data.links).toEqual([
      { source: 'applied', target: 'screening', value: 1 },
      { source: 'applied', target: 'no_response', value: 1 },
      { source: 'screening', target: 'rejected', value: 1 },
    ]);
    expect(data.nodes.map((n) => n.name)).toEqual(['applied', 'screening', 'rejected', 'no_response']);
  });

  it('returns empty data for no applications', () => {
    expect(buildSankey([])).toEqual({ nodes: [], links: [] });
  });
});
