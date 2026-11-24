import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { addDays, DateRangeSchema, todayIso, type DateRange } from '@applications-db/shared';
import { DateRangePicker } from '../components/DateRangePicker';
import type { EChartInstance } from '../components/EChart';
import { EmptyState } from '../components/EmptyState';
import { ReportCharts, type ChartKey } from '../components/ReportCharts';
import { useReport } from '../data/hooks';
import { exportChartPng } from '../lib/exportPng';
import { formatPercent } from '../lib/format';
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
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Reports</h1>
        <button
          type="button"
          data-print-hide
          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
          onClick={() => window.print()}
        >
          Print / Save as PDF
        </button>
      </div>
      <div data-print-hide>
        <DateRangePicker
          value={range}
          onChange={(r) => setParams({ from: r.from, to: r.to }, { replace: true })}
        />
      </div>
      <p className="text-slate-700">
        {range.from} to {range.to}
      </p>
      {exportError && (
        <p role="alert" className="text-red-700">
          Couldn't export the chart image.
        </p>
      )}
      {isPending && <p className="text-slate-600">Loading...</p>}
      {isError && (
        <p role="alert" className="text-red-700">
          Could not load the report.
        </p>
      )}
      {data &&
        (data.total === 0 ? (
          <EmptyState title="No applications in this date range" />
        ) : (
          <>
            <p className="text-slate-700">
              {data.total} {data.total === 1 ? 'application' : 'applications'}, response rate{' '}
              {formatPercent(data.responseRate)}
            </p>
            <ReportCharts
              data={data}
              onChartReady={(key, instance) => instances.current.set(key, instance)}
              renderAction={({ key, title }) => (
                <button
                  type="button"
                  data-print-hide
                  aria-label={`Download PNG, ${title}`}
                  className="rounded border border-slate-300 px-2 py-1 text-sm hover:bg-slate-50"
                  onClick={() => void downloadPng(key)}
                >
                  Download PNG
                </button>
              )}
            />
          </>
        ))}
    </div>
  );
}
