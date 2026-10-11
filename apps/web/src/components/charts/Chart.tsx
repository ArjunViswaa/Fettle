import { BarChart, HeatmapChart, LineChart, PieChart, ScatterChart } from 'echarts/charts';
import {
  AriaComponent,
  CalendarComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import { useEffect, useMemo, useRef } from 'react';
import { useTheme } from '../../lib/theme';
import { cn, cssVar } from '../../lib/utils';

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  HeatmapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CalendarComponent,
  VisualMapComponent,
  MarkLineComponent,
  MarkAreaComponent,
  AriaComponent,
  SVGRenderer,
]);

export type EChartsOption = echarts.EChartsCoreOption;

export interface ChartTheme {
  text: string;
  text2: string;
  text3: string;
  surface: string;
  surface2: string;
  grid: string;
  axis: string;
  track: string;
  font: string;
  dark: boolean;
  c: (token: string) => string;
  /** Blend two hex colours; ECharts needs real colours it can interpolate, not color-mix(). */
  mix: (a: string, b: string, weightOfA: number) => string;
}

function mixHex(a: string, b: string, w: number) {
  const parse = (hex: string) => {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h.slice(0, 6);
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  };
  const [x, y] = [parse(a), parse(b)];
  return `#${x.map((v, i) => Math.round(v * w + y[i]! * (1 - w)).toString(16).padStart(2, '0')).join('')}`;
}

export function readChartTheme(dark: boolean): ChartTheme {
  return {
    text: cssVar('--text'),
    text2: cssVar('--text-2'),
    text3: cssVar('--text-3'),
    surface: cssVar('--surface'),
    surface2: cssVar('--surface-2'),
    grid: cssVar('--grid'),
    axis: cssVar('--axis'),
    track: cssVar('--surface-3'),
    font: "'Inter Variable', system-ui, sans-serif",
    dark,
    c: (token) => cssVar(`--c-${token}`) || cssVar(`--${token}`),
    mix: mixHex,
  };
}

/** Shared tooltip look: a small card in the app's own surface colours. */
export function tooltipBase(t: ChartTheme) {
  return {
    backgroundColor: t.surface,
    borderColor: t.axis,
    borderWidth: 1,
    padding: [10, 12],
    textStyle: { color: t.text, fontFamily: t.font, fontSize: 12 },
    extraCssText: `border-radius:12px;box-shadow:0 12px 32px -12px rgba(0,0,0,${t.dark ? 0.6 : 0.18});`,
  };
}

/** Category x-axis of days plus a quiet value axis, used by most charts. */
export function dayAxes(t: ChartTheme, days: string[], opts: { min?: number | 'dataMin'; max?: number; unit?: string } = {}) {
  return {
    xAxis: {
      type: 'category',
      data: days,
      axisLine: { lineStyle: { color: t.axis } },
      axisTick: { show: false },
      axisLabel: {
        color: t.text3,
        fontSize: 11,
        hideOverlap: true,
        formatter: (d: string) => {
          const date = new Date(`${d}T12:00:00`);
          return days.length > 14 ? date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : date.toLocaleDateString(undefined, { weekday: 'short' });
        },
      },
    },
    yAxis: {
      type: 'value',
      min: opts.min,
      max: opts.max,
      splitNumber: 3,
      axisLabel: { color: t.text3, fontSize: 11, formatter: (v: number) => `${v.toLocaleString()}${opts.unit ?? ''}` },
      splitLine: { lineStyle: { color: t.grid, type: 'dashed' } },
    },
  };
}

interface ChartProps {
  /** Builds the option from the current theme, so colours follow light/dark. */
  option: (theme: ChartTheme) => EChartsOption;
  height: number | string;
  ariaLabel: string;
  className?: string;
}

export function Chart({ option, height, ariaLabel, className }: ChartProps) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const { resolved } = useTheme();

  useEffect(() => {
    if (!el.current) return;
    const instance = echarts.init(el.current, undefined, { renderer: 'svg' });
    chart.current = instance;
    const ro = new ResizeObserver(() => instance.resize({ animation: { duration: 200 } }));
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      instance.dispose();
      chart.current = null;
    };
  }, []);

  const built = useMemo(() => option(readChartTheme(resolved === 'dark')), [option, resolved]);

  useEffect(() => {
    chart.current?.setOption(
      {
        aria: { enabled: true, label: { description: ariaLabel } },
        textStyle: { fontFamily: "'Inter Variable', system-ui, sans-serif" },
        animationDuration: 900,
        animationEasing: 'cubicOut',
        grid: { left: 8, right: 12, top: 16, bottom: 4, containLabel: true },
        ...built,
      },
      { notMerge: true },
    );
  }, [built, ariaLabel]);

  return <div ref={el} role="img" aria-label={ariaLabel} className={cn('w-full', className)} style={{ height }} />;
}
