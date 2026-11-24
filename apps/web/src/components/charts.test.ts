import { describe, expect, it } from 'vitest';
import { computeReport } from '@applications-db/shared';
import {
  daysHistogramOption,
  perWeekOption,
  responseRateBySourceOption,
  sankeyOption,
  sourceDonutOption,
  statusDonutOption,
} from './charts';
import { STATUS_COLORS } from '../lib/statusColors';

type SeriesLike = { data: unknown[]; links?: unknown[] };
const firstSeries = (o: unknown): SeriesLike => (o as { series: SeriesLike[] }).series[0]!;

describe('charts option builders', () => {
  it('sankeyOption labels no_response and preserves link values', () => {
    const option = sankeyOption({
      nodes: [{ name: 'applied' }, { name: 'no_response' }],
      links: [{ source: 'applied', target: 'no_response', value: 3 }],
    });
    const s = firstSeries(option) as { data: { name: string; label?: string }[]; links: { value: number }[] };
    expect(JSON.stringify(s.data)).toContain('No response yet');
    expect(s.links.map((l) => l.value)).toEqual([3]);
  });

  it('statusDonutOption with an empty breakdown has empty data and no NaN', () => {
    const option = statusDonutOption([]);
    expect(firstSeries(option).data).toEqual([]);
    expect(JSON.stringify(option)).not.toContain('NaN');
  });

  it('every builder survives an empty report without NaN', () => {
    const r = computeReport([]);
    const options = [
      sankeyOption(r.sankey),
      statusDonutOption(r.statusBreakdown),
      sourceDonutOption(r.bySource),
      perWeekOption(r.perWeek),
      responseRateBySourceOption(r.responseRateBySource),
      daysHistogramOption(r.daysToFirstResponse),
    ];
    for (const o of options) expect(JSON.stringify(o)).not.toContain('NaN');
  });

  it('uses human labels for statuses and sources', () => {
    expect(JSON.stringify(statusDonutOption([{ status: 'applied', count: 2 }]))).toContain('Applied');
    expect(JSON.stringify(sourceDonutOption([{ source: 'company_site', count: 1 }]))).toContain('Company site');
  });

  it('colours status donut items with the shared status palette', () => {
    const s = firstSeries(statusDonutOption([{ status: 'interview', count: 2 }])) as {
      data: { itemStyle?: { color?: string } }[];
    };
    expect(s.data[0]!.itemStyle?.color).toBe(STATUS_COLORS.interview.hex);
  });

  it('colours status sankey nodes with the shared status palette', () => {
    const option = sankeyOption({
      nodes: [{ name: 'applied' }, { name: 'offer' }],
      links: [{ source: 'applied', target: 'offer', value: 1 }],
    });
    const s = firstSeries(option) as { data: { name: string; itemStyle?: { color?: string } }[] };
    expect(s.data.find((n) => n.name === 'Offer')?.itemStyle?.color).toBe(STATUS_COLORS.offer.hex);
  });

  it('responseRateBySourceOption renders a null rate as 0 percent', () => {
    const o = responseRateBySourceOption([{ source: 'other', applications: 0, responded: 0, rate: null }]);
    expect(firstSeries(o).data).toEqual([0]);
  });
});
