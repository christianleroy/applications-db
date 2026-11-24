import type { EChartsOption } from 'echarts';
import type { ReportData, SankeyData, SankeyNodeName } from '@applications-db/shared';
import { SOURCE_LABELS, STATUS_LABELS } from '../lib/labels';

const NO_RESPONSE_LABEL = 'No response yet';

const nodeLabel = (n: SankeyNodeName): string => (n === 'no_response' ? NO_RESPONSE_LABEL : STATUS_LABELS[n]);

export function sankeyOption(d: SankeyData): EChartsOption {
  return {
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'sankey',
        data: d.nodes.map((n) => ({ name: nodeLabel(n.name) })),
        links: d.links.map((l) => ({ source: nodeLabel(l.source), target: nodeLabel(l.target), value: l.value })),
        emphasis: { focus: 'adjacency' },
        lineStyle: { color: 'gradient', curveness: 0.5 },
      },
    ],
  };
}

function donut(data: { name: string; value: number }[]): EChartsOption {
  return {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [{ type: 'pie', radius: ['45%', '70%'], data }],
  };
}

export function statusDonutOption(d: ReportData['statusBreakdown']): EChartsOption {
  return donut(d.map((x) => ({ name: STATUS_LABELS[x.status], value: x.count })));
}

export function sourceDonutOption(d: ReportData['bySource']): EChartsOption {
  return donut(d.map((x) => ({ name: SOURCE_LABELS[x.source], value: x.count })));
}

export function perWeekOption(d: ReportData['perWeek']): EChartsOption {
  return {
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: d.map((x) => x.weekStart) },
    yAxis: { type: 'value', minInterval: 1 },
    series: [{ type: 'bar', name: 'Applications', data: d.map((x) => x.count) }],
  };
}

export function responseRateBySourceOption(d: ReportData['responseRateBySource']): EChartsOption {
  return {
    tooltip: { trigger: 'axis', valueFormatter: (v) => `${v}%` },
    xAxis: { type: 'category', data: d.map((x) => SOURCE_LABELS[x.source]) },
    yAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
    series: [{ type: 'bar', name: 'Response rate', data: d.map((x) => (x.rate === null ? 0 : Math.round(x.rate * 100))) }],
  };
}

export function daysHistogramOption(d: ReportData['daysToFirstResponse']): EChartsOption {
  return {
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', name: 'Days', data: d.map((x) => x.bucket) },
    yAxis: { type: 'value', minInterval: 1 },
    series: [{ type: 'bar', name: 'Applications', data: d.map((x) => x.count) }],
  };
}
