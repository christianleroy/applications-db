import type { Status } from '@applications-db/shared';
import { STATUS_LABELS } from '../lib/labels';

const COLORS: Record<Status, string> = {
  applied: 'bg-slate-100 text-slate-800',
  screening: 'bg-sky-100 text-sky-800',
  interview: 'bg-indigo-100 text-indigo-800',
  offer: 'bg-emerald-100 text-emerald-800',
  accepted: 'bg-green-200 text-green-900',
  rejected: 'bg-red-100 text-red-800',
  ghosted: 'bg-amber-100 text-amber-800',
  withdrawn: 'bg-zinc-200 text-zinc-800',
};

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${COLORS[status]}`}>{STATUS_LABELS[status]}</span>;
}
