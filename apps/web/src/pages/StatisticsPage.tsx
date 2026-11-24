import { EChart } from '../components/EChart';
import {
  daysHistogramOption,
  perWeekOption,
  responseRateBySourceOption,
  sankeyOption,
  sourceDonutOption,
  statusDonutOption,
} from '../components/charts';
import { KpiTile } from '../components/KpiTile';
import { useStatistics } from '../data/hooks';
import { formatPercent } from '../lib/format';

export function StatisticsPage() {
  const { data, isPending, isError } = useStatistics();

  if (isPending) return <p className="text-slate-600">Loading...</p>;
  if (isError) return <p role="alert" className="text-red-700">Could not load statistics.</p>;

  const charts = [
    { title: 'Status flow', label: 'Status flow (Sankey chart)', option: sankeyOption(data.sankey), wide: true },
    { title: 'By status', label: 'Applications by status', option: statusDonutOption(data.statusBreakdown) },
    { title: 'By source', label: 'Applications by source', option: sourceDonutOption(data.bySource) },
    { title: 'Applications per week', label: 'Applications per week', option: perWeekOption(data.perWeek) },
    {
      title: 'Response rate by source',
      label: 'Response rate by source',
      option: responseRateBySourceOption(data.responseRateBySource),
    },
    {
      title: 'Days to first response',
      label: 'Days to first response',
      option: daysHistogramOption(data.daysToFirstResponse),
    },
  ];

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
        <div className="grid gap-4 md:grid-cols-2">
          {charts.map((c) => (
            <section key={c.title} className={`rounded border border-slate-200 bg-white p-4 ${c.wide ? 'md:col-span-2' : ''}`}>
              <h2 className="mb-2 font-semibold text-slate-900">{c.title}</h2>
              <EChart option={c.option} ariaLabel={c.label} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
