import type { ReactNode } from 'react';

export function EmptyState({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="rounded border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
      <p className="text-slate-700">{title}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
