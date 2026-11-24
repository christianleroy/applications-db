import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { todayIso, type Application } from '@applications-db/shared';
import { KpiTile } from '../components/KpiTile';
import { StatusBadge } from '../components/StatusBadge';
import { useAddStatus, useDashboard } from '../data/hooks';
import { formatDate, formatPercent } from '../lib/format';

function Section({ title, empty, isEmpty, children }: { title: string; empty: string; isEmpty: boolean; children: ReactNode }) {
  return (
    <section className="rounded border border-slate-200 bg-white p-4">
      <h2 className="mb-2 font-semibold text-slate-900">{title}</h2>
      {isEmpty ? <p className="text-sm text-slate-600">{empty}</p> : <ul className="divide-y divide-slate-100">{children}</ul>}
    </section>
  );
}

const linkClass = 'text-blue-700 hover:underline';

function AppLink({ app }: { app: Application }) {
  return (
    <Link to={`/applications/${app.id}`} className={linkClass}>
      {app.company} - {app.role}
    </Link>
  );
}

export function DashboardPage() {
  const { data, isPending, isError } = useDashboard();
  const addStatus = useAddStatus();

  if (isPending) return <p className="text-slate-600">Loading...</p>;
  if (isError) return <p role="alert" className="text-red-700">Could not load the dashboard.</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiTile label="Active" value={data.activeCount} />
        <KpiTile label="In interview" value={data.interviewCount} />
        <KpiTile label="Offers" value={data.offerCount} />
        <KpiTile label="Response rate" value={formatPercent(data.responseRate)} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Follow-ups due" empty="No follow-ups due" isEmpty={data.followUpsDue.length === 0}>
          {data.followUpsDue.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 py-2">
              <AppLink app={a} />
              <span className="text-sm text-slate-600">{a.followUpDate ? formatDate(a.followUpDate) : ''}</span>
            </li>
          ))}
        </Section>
        <Section title="Stale (21+ days without change)" empty="Nothing stale" isEmpty={data.stale.length === 0}>
          {data.stale.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 py-2">
              <AppLink app={a} />
              <button
                type="button"
                disabled={addStatus.isPending}
                onClick={() => addStatus.mutate({ id: a.id, input: { status: 'ghosted', date: todayIso() } })}
                className="rounded border border-slate-300 px-2 py-1 text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                Mark ghosted
              </button>
            </li>
          ))}
        </Section>
      </div>
      <Section title="Recent activity" empty="No recent activity" isEmpty={data.recentActivity.length === 0}>
        {data.recentActivity.map((item) => (
          <li key={item.entry.id} className="flex items-center justify-between gap-2 py-2">
            <Link to={`/applications/${item.applicationId}`} className={linkClass}>
              {item.company} - {item.role}
            </Link>
            <span className="flex items-center gap-2 text-sm text-slate-600">
              <StatusBadge status={item.entry.status} />
              {formatDate(item.entry.date)}
            </span>
          </li>
        ))}
      </Section>
    </div>
  );
}
