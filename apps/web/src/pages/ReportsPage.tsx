import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { addDays, DateRangeSchema, todayIso, type DateRange } from '@applications-db/shared';
import { DownloadIcon, PrinterIcon } from 'lucide-react';
import { DateRangePicker } from '../components/DateRangePicker';
import type { EChartInstance } from '../components/EChart';
import { EmptyState } from '../components/EmptyState';
import { PageHeader, PageStatus } from '../components/PageHeader';
import { ReportCharts, type ChartKey } from '../components/ReportCharts';
import { Button } from '@/components/ui/button';
import { useReport } from '../data/hooks';
import { exportChartPng } from '../lib/exportPng';
import { formatDate, formatPercent } from '../lib/format';
import '../print.css';

function rangeFromParams(params: URLSearchParams): DateRange {
  const parsed = DateRangeSchema.safeParse({ from: params.get('from'), to: params.get('to') });
  if (parsed.success) return parsed.data;
  const today = todayIso();
  return { from: addDays(today, -89), to: today };
}

export function ReportsPage() {
  const [params, setParams] = useSearchParams();
  const range = rangeFromParams(params);
  const { data, isPending, isError } = useReport(range);
  const [exportError, setExportError] = useState(false);
  const instances = useRef(new Map<ChartKey, EChartInstance>());

  async function downloadPng(key: ChartKey) {
    const instance = instances.current.get(key);
    if (!instance) return;
    setExportError(false);
    try {
      await exportChartPng(instance, { key, ...range });
    } catch {
      setExportError(true);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Reports"
        description={
          <>
            {formatDate(range.from)} to {formatDate(range.to)}
          </>
        }
        actions={
          <Button type="button" variant="outline" data-print-hide onClick={() => window.print()}>
            <PrinterIcon aria-hidden="true" />
            Print / Save as PDF
          </Button>
        }
      />
      <div data-print-hide>
        <DateRangePicker
          value={range}
          onChange={(r) => setParams({ from: r.from, to: r.to }, { replace: true })}
        />
      </div>
      {exportError && <PageStatus error>Couldn't export the chart image.</PageStatus>}
      {isPending && <PageStatus>Loading...</PageStatus>}
      {isError && <PageStatus error>Could not load the report.</PageStatus>}
      {data &&
        (data.total === 0 ? (
          <EmptyState title="No applications in this date range" />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {data.total} {data.total === 1 ? 'application' : 'applications'}, response rate{' '}
              {formatPercent(data.responseRate)}
            </p>
            <ReportCharts
              data={data}
              onChartReady={(key, instance) => instances.current.set(key, instance)}
              renderAction={({ key, title }) => (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-print-hide
                  aria-label={`Download PNG, ${title}`}
                  className="text-muted-foreground"
                  onClick={() => void downloadPng(key)}
                >
                  <DownloadIcon aria-hidden="true" />
                  Download PNG
                </Button>
              )}
            />
          </>
        ))}
    </div>
  );
}
