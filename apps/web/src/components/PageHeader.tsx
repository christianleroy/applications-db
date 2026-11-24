import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** The page title row: an h1, optional muted description and right-aligned actions. */
export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A loading or error line; errors are announced as alerts. */
export function PageStatus({ error = false, children }: { error?: boolean; children: ReactNode }) {
  return (
    <p
      role={error ? 'alert' : undefined}
      className={cn(
        'text-sm',
        error ? 'rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive' : 'text-muted-foreground',
      )}
    >
      {children}
    </p>
  );
}
