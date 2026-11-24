import { useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { addDays, DateRangeSchema, todayIso, type DateRange } from '@applications-db/shared';
import { DateRangePicker } from '../components/DateRangePicker';
import type { EChartInstance } from '../components/EChart';
import { EmptyState } from '../components/EmptyState';
import { ReportCharts, type ChartKey } from '../components/ReportCharts';
import { useReport } from '../data/hooks';
import { formatPercent } from '../lib/format';
import '../print.css';

function rangeFromParams(params: URLSearchParams): DateRange {
  const parsed = DateRangeSchema.safeParse({ from: params.get('from'), to: params.get('to') });
  if (parsed.success) return parsed.data;
  const today = todayIso();
  return { from: addDays(today, -89), to: today };
}

function rasterise(src: string, width: number, height: number, scale = 2): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas is not available'));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Could not render the chart image'));
    img.src = src;
  });
}

export function ReportsPage() {
  const [params, setParams] = useSearchParams();
  const range = rangeFromParams(params);
  const { data, isPending, isError } = useReport(range);
  const instances = useRef(new Map<ChartKey, EChartInstance>());

  async function downloadPng(key: ChartKey) {
    const instance = instances.current.get(key);
    if (!instance) return;
    const url = instance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' });
    // With the SVG renderer getDataURL returns an SVG data URL whatever `type` says,
    // so rasterise it onto a white canvas to produce a real PNG.
    const href = url.startsWith('data:image/png') ? url : await rasterise(url, instance.getWidth(), instance.getHeight());
    const a = document.createElement('a');
    a.href = href;
    a.download = `applications-${key}-${range.from}_${range.to}.png`;
    a.click();
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
                  onClick={() => void downloadPng(key).catch(() => undefined)}
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
