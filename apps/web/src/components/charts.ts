import type { EChartsOption } from 'echarts';
import type { ReportData, SankeyData, SankeyNodeName } from '@applications-db/shared';
import { SOURCE_LABELS, STATUS_LABELS } from '../lib/labels';
import { NO_RESPONSE_COLOR, SOURCE_COLORS, STATUS_COLORS } from '../lib/statusColors';

const NO_RESPONSE_LABEL = 'No response yet';

const nodeLabel = (n: SankeyNodeName): string => (n === 'no_response' ? NO_RESPONSE_LABEL : STATUS_LABELS[n]);
const nodeColor = (n: SankeyNodeName): string => (n === 'no_response' ? NO_RESPONSE_COLOR : STATUS_COLORS[n].hex);

/** Shared muted chrome so every chart reads as one flat system. */
const AXIS_TEXT = '#57534e';
const GRID_LINE = '#e7e5e4';
const BAR_COLOR = '#78716c';

// Explicit system stack (not 'inherit'): PNG export rasterises the SVG outside the page.
const FONT = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const textStyle = { fontFamily: FONT, color: AXIS_TEXT };

const categoryAxis = {
  axisLine: { lineStyle: { color: GRID_LINE } },
  axisTick: { show: false },
  axisLabel: { color: AXIS_TEXT },
} as const;

const valueAxis = {
  splitLine: { lineStyle: { color: GRID_LINE } },
  axisLabel: { color: AXIS_TEXT },
} as const;

const grid = { left: 40, right: 16, top: 24, bottom: 32 } as const;

export function sankeyOption(d: SankeyData): EChartsOption {
  return {
    textStyle,
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'sankey',
        nodeGap: 12,
        label: { color: '#111111' },
        data: d.nodes.map((n) => ({ name: nodeLabel(n.name), itemStyle: { color: nodeColor(n.name), borderWidth: 0 } })),
        links: d.links.map((l) => ({ source: nodeLabel(l.source), target: nodeLabel(l.target), value: l.value })),
        emphasis: { focus: 'adjacency' },
        lineStyle: { color: 'gradient', curveness: 0.5, opacity: 0.35 },
      },
    ],
  };
}

type DonutDatum = { name: string; value: number; itemStyle: { color: string } };

function donut(data: DonutDatum[]): EChartsOption {
  return {
    textStyle,
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, textStyle: { color: AXIS_TEXT } },
    series: [
      {
        type: 'pie',
        radius: ['48%', '70%'],
        center: ['50%', '45%'],
        itemStyle: { borderColor: '#ffffff', borderWidth: 2 },
        label: { show: false },
        data,
      },
    ],
  };
}

export function statusDonutOption(d: ReportData['statusBreakdown']): EChartsOption {
  return donut(d.map((x) => ({ name: STATUS_LABELS[x.status], value: x.count, itemStyle: { color: STATUS_COLORS[x.status].hex } })));
}

export function sourceDonutOption(d: ReportData['bySource']): EChartsOption {
  return donut(d.map((x) => ({ name: SOURCE_LABELS[x.source], value: x.count, itemStyle: { color: SOURCE_COLORS[x.source] } })));
}

export function perWeekOption(d: ReportData['perWeek']): EChartsOption {
  return {
    textStyle,
    grid,
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: d.map((x) => x.weekStart), ...categoryAxis },
    yAxis: { type: 'value', minInterval: 1, ...valueAxis },
    series: [{ type: 'bar', name: 'Applications', data: d.map((x) => x.count), itemStyle: { color: BAR_COLOR, borderRadius: [3, 3, 0, 0] }, barMaxWidth: 28 }],
  };
}

export function responseRateBySourceOption(d: ReportData['responseRateBySource']): EChartsOption {
  return {
    textStyle,
    grid,
    tooltip: { trigger: 'axis', valueFormatter: (v) => `${v}%` },
    xAxis: { type: 'category', data: d.map((x) => SOURCE_LABELS[x.source]), ...categoryAxis },
    yAxis: { type: 'value', min: 0, max: 100, ...valueAxis, axisLabel: { ...valueAxis.axisLabel, formatter: '{value}%' } },
    series: [
      {
        type: 'bar',
        name: 'Response rate',
        data: d.map((x) => (x.rate === null ? 0 : Math.round(x.rate * 100))),
        itemStyle: {
          color: (p: { dataIndex: number }) => SOURCE_COLORS[d[p.dataIndex]!.source],
          borderRadius: [3, 3, 0, 0],
        },
        barMaxWidth: 28,
      },
    ],
  };
}

export function daysHistogramOption(d: ReportData['daysToFirstResponse']): EChartsOption {
  return {
    textStyle,
    grid: { ...grid, right: 40 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', name: 'Days', nameTextStyle: { color: AXIS_TEXT }, data: d.map((x) => x.bucket), ...categoryAxis },
    yAxis: { type: 'value', minInterval: 1, ...valueAxis },
    series: [{ type: 'bar', name: 'Applications', data: d.map((x) => x.count), itemStyle: { color: BAR_COLOR, borderRadius: [3, 3, 0, 0] }, barMaxWidth: 28 }],
  };
}
