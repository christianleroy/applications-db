import type { ReactNode } from 'react';
import type { ReportData } from '@applications-db/shared';
import { EChart, type EChartInstance } from './EChart';
import {
  daysHistogramOption,
  perWeekOption,
  responseRateBySourceOption,
  sankeyOption,
  sourceDonutOption,
  statusDonutOption,
} from './charts';
import { cn } from '@/lib/utils';

export type ChartKey = 'status-flow' | 'by-status' | 'by-source' | 'per-week' | 'response-rate-by-source' | 'days-to-response';

type Props = {
  data: ReportData;
  /** Optional per-chart extras (e.g. a download button), rendered beside the chart title. */
  renderAction?: (chart: { key: ChartKey; title: string }) => ReactNode;
  onChartReady?: (key: ChartKey, instance: EChartInstance) => void;
};

/** The six report charts, shared by the Statistics and Reports pages. */
export function ReportCharts({ data, renderAction, onChartReady }: Props) {
  const charts = [
    { key: 'status-flow', title: 'Status flow', label: 'Status flow (Sankey chart)', option: sankeyOption(data.sankey), wide: true },
    { key: 'by-status', title: 'By status', label: 'Applications by status', option: statusDonutOption(data.statusBreakdown) },
    { key: 'by-source', title: 'By source', label: 'Applications by source', option: sourceDonutOption(data.bySource) },
    { key: 'per-week', title: 'Applications per week', label: 'Applications per week', option: perWeekOption(data.perWeek) },
    {
      key: 'response-rate-by-source',
      title: 'Response rate by source',
      label: 'Response rate by source',
      option: responseRateBySourceOption(data.responseRateBySource),
    },
    {
      key: 'days-to-response',
      title: 'Days to first response',
      label: 'Days to first response',
      option: daysHistogramOption(data.daysToFirstResponse),
    },
  ] as const;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {charts.map((c) => (
        <section
          key={c.key}
          className={cn('chart-block min-w-0 rounded-lg border bg-card p-5', 'wide' in c && 'md:col-span-2')}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">{c.title}</h2>
            {renderAction?.({ key: c.key, title: c.title })}
          </div>
          <EChart option={c.option} ariaLabel={c.label} onReady={onChartReady && ((i) => onChartReady(c.key, i))} />
        </section>
      ))}
    </div>
  );
}
