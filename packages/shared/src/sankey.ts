import { PROGRESS_STAGES, TERMINAL_EXIT_STATUSES } from './enums';
import type { Application, Status } from './schemas';

export type SankeyNodeName = Status | 'no_response';
export type SankeyData = {
  nodes: { name: SankeyNodeName }[];
  links: { source: SankeyNodeName; target: SankeyNodeName; value: number }[];
};

const NODE_ORDER: readonly SankeyNodeName[] = [
  ...PROGRESS_STAGES,
  'rejected',
  'ghosted',
  'withdrawn',
  'no_response',
];
const rank = (n: SankeyNodeName) => NODE_ORDER.indexOf(n);

/** Forward-only path: only advances past the furthest stage reached, then the terminal exit if any. */
export function forwardPath(app: Application): SankeyNodeName[] {
  const path: SankeyNodeName[] = [];
  let maxIdx = -1;
  for (const e of app.statusHistory) {
    const idx = PROGRESS_STAGES.indexOf(e.status as never);
    if (idx > maxIdx) {
      path.push(e.status);
      maxIdx = idx;
    }
  }
  if (TERMINAL_EXIT_STATUSES.includes(app.status as never)) path.push(app.status);
  else if (path.length === 1 && app.status === 'applied') path.push('no_response');
  return path;
}

export function buildSankey(apps: Application[]): SankeyData {
  const counts = new Map<string, { source: SankeyNodeName; target: SankeyNodeName; value: number }>();
  for (const app of apps) {
    const path = forwardPath(app);
    for (let i = 0; i < path.length - 1; i++) {
      const source = path[i]!;
      const target = path[i + 1]!;
      const key = `${source}>${target}`;
      const link = counts.get(key);
      if (link) link.value++;
      else counts.set(key, { source, target, value: 1 });
    }
  }
  const links = [...counts.values()].sort((a, b) => rank(a.source) - rank(b.source) || rank(a.target) - rank(b.target));
  const used = new Set<SankeyNodeName>(links.flatMap((l) => [l.source, l.target]));
  const nodes = NODE_ORDER.filter((n) => used.has(n)).map((name) => ({ name }));
  return { nodes, links };
}
