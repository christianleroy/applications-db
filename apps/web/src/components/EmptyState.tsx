import type { ReactNode } from 'react';
import { InboxIcon } from 'lucide-react';

export function EmptyState({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-card px-4 py-12 text-center">
      <InboxIcon aria-hidden="true" className="size-6 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{title}</p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
