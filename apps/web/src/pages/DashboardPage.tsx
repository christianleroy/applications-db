import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { todayIso, type Application } from '@applications-db/shared';
import { KpiTile } from '../components/KpiTile';
import { PageHeader, PageStatus } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { Button } from '@/components/ui/button';
import { useAddStatus, useDashboard } from '../data/hooks';
import { formatDate, formatPercent } from '../lib/format';

function Section({ title, empty, isEmpty, children }: { title: string; empty: string; isEmpty: boolean; children: ReactNode }) {
  return (
    <section className="flex flex-col rounded-lg border bg-card">
      <h2 className="px-5 pt-4 pb-3 text-sm font-semibold">{title}</h2>
      {isEmpty ? (
        <p className="border-t px-5 py-4 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y border-t">{children}</ul>
      )}
    </section>
  );
}

const linkClass = 'min-w-0 truncate font-medium underline-offset-4 hover:text-primary hover:underline';
const itemClass = 'flex min-h-12 items-center justify-between gap-3 px-5 py-2 text-sm';

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

  if (isPending) return <PageStatus>Loading...</PageStatus>;
  if (isError) return <PageStatus error>Could not load the dashboard.</PageStatus>;

  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiTile label="Active" value={data.activeCount} />
        <KpiTile label="In interview" value={data.interviewCount} />
        <KpiTile label="Offers" value={data.offerCount} />
        <KpiTile label="Response rate" value={formatPercent(data.responseRate)} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Follow-ups due" empty="No follow-ups due" isEmpty={data.followUpsDue.length === 0}>
          {data.followUpsDue.map((a) => (
            <li key={a.id} className={itemClass}>
              <AppLink app={a} />
              <span className="shrink-0 text-muted-foreground tabular-nums">{a.followUpDate ? formatDate(a.followUpDate) : ''}</span>
            </li>
          ))}
        </Section>
        <Section title="Stale (21+ days without change)" empty="Nothing stale" isEmpty={data.stale.length === 0}>
          {data.stale.map((a) => (
            <li key={a.id} className={itemClass}>
              <AppLink app={a} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={addStatus.isPending}
                onClick={() => addStatus.mutate({ id: a.id, input: { status: 'ghosted', date: todayIso() } })}
              >
                Mark ghosted
              </Button>
            </li>
          ))}
        </Section>
      </div>
      <Section title="Recent activity" empty="No recent activity" isEmpty={data.recentActivity.length === 0}>
        {data.recentActivity.map((item) => (
          <li key={item.entry.id} className={itemClass}>
            <Link to={`/applications/${item.applicationId}`} className={linkClass}>
              {item.company} - {item.role}
            </Link>
            <span className="flex shrink-0 items-center gap-3 text-muted-foreground tabular-nums">
              <StatusBadge status={item.entry.status} />
              {formatDate(item.entry.date)}
            </span>
          </li>
        ))}
      </Section>
    </div>
  );
}
