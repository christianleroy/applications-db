import { KpiTile } from '../components/KpiTile';
import { ReportCharts } from '../components/ReportCharts';
import { useStatistics } from '../data/hooks';
import { formatPercent } from '../lib/format';

export function StatisticsPage() {
  const { data, isPending, isError } = useStatistics();

  if (isPending) return <p className="text-slate-600">Loading...</p>;
  if (isError) return <p role="alert" className="text-red-700">Could not load statistics.</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Statistics</h1>
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
        <p className="text-slate-600">No applications yet, so there is nothing to chart.</p>
      ) : (
        <ReportCharts data={data} />
      )}
    </div>
  );
}
