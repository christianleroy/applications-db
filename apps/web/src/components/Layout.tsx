import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { config } from '../config';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/applications', label: 'Applications', end: false },
  { to: '/statistics', label: 'Statistics', end: false },
  { to: '/reports', label: 'Reports', end: false },
];

export function Layout({ headerActions }: { headerActions?: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-page text-foreground">
      <header data-print-hide className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3 sm:px-6">
          <span className="text-base font-semibold tracking-tight">Applications</span>
          <div className="ml-auto sm:order-last">{headerActions}</div>
          <nav
            className="-mx-1 flex w-full gap-1 overflow-x-auto sm:mx-0 sm:w-auto sm:flex-1"
            aria-label="Main"
          >
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-2 py-1.5 text-sm whitespace-nowrap underline-offset-[6px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/70',
                    isActive
                      ? 'font-medium text-white underline decoration-2'
                      : 'text-white/75 hover:bg-white/10 hover:text-white',
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <Outlet />
      </main>
      <footer data-print-hide className="border-t bg-background px-4 py-4 text-center text-xs text-muted-foreground">
        {config.dataSource === 'memory'
          ? 'Data source: In-memory (sample data, resets on reload)'
          : 'Data source: API'}
      </footer>
    </div>
  );
}
