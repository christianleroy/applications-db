import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { BarChart, PieChart, SankeyChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import type { EChartsOption } from 'echarts';

echarts.use([BarChart, PieChart, SankeyChart, GridComponent, LegendComponent, TooltipComponent, SVGRenderer]);

export type EChartInstance = ReturnType<typeof echarts.init>;

type Props = {
  option: EChartsOption;
  ariaLabel: string;
  onReady?: (instance: EChartInstance) => void;
};

/** Thin wrapper over echarts-for-react: SVG renderer, transparent background, neutral colours. */
export function EChart({ option, ariaLabel, onReady }: Props) {
  return (
    <div role="img" aria-label={ariaLabel}>
      <ReactEChartsCore
        echarts={echarts}
        option={{ backgroundColor: 'transparent', ...option }}
        opts={{ renderer: 'svg' }}
        style={{ height: 320 }}
        onChartReady={onReady}
        notMerge
      />
    </div>
  );
}
