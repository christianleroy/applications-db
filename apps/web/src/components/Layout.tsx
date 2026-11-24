import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { config } from '../config';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/applications', label: 'Applications', end: false },
  { to: '/statistics', label: 'Statistics', end: false },
  { to: '/reports', label: 'Reports', end: false },
];

export function Layout({ headerActions }: { headerActions?: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header data-print-hide className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <span className="font-semibold">Applications</span>
          <nav className="flex flex-1 gap-4" aria-label="Main">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  isActive ? 'font-medium text-blue-700' : 'text-slate-600 hover:text-slate-900'
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div>{headerActions}</div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <footer data-print-hide className="border-t border-slate-200 px-4 py-3 text-center text-sm text-slate-500">
        {config.dataSource === 'memory'
          ? 'Data source: In-memory (sample data, resets on reload)'
          : 'Data source: API'}
      </footer>
    </div>
  );
}
