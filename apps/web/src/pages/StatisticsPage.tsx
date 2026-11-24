import { EmptyState } from '../components/EmptyState';
import { KpiTile } from '../components/KpiTile';
import { PageHeader, PageStatus } from '../components/PageHeader';
import { ReportCharts } from '../components/ReportCharts';
import { useStatistics } from '../data/hooks';
import { formatPercent } from '../lib/format';

export function StatisticsPage() {
  const { data, isPending, isError } = useStatistics();

  if (isPending) return <PageStatus>Loading...</PageStatus>;
  if (isError) return <PageStatus error>Could not load statistics.</PageStatus>;

  return (
    <div className="space-y-8">
      <PageHeader title="Statistics" description="All applications, all time." />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiTile label="Total applications" value={data.total} />
        <KpiTile label="Responded" value={data.responded} />
        <KpiTile label="Response rate" value={formatPercent(data.responseRate)} />
        <KpiTile
          label="Median days to first response"
          value={data.medianDaysToFirstResponse === null ? '—' : data.medianDaysToFirstResponse}
        />
      </div>
      {data.total === 0 ? (
        <EmptyState title="No applications yet, so there is nothing to chart." />
      ) : (
        <ReportCharts data={data} />
      )}
    </div>
  );
}
