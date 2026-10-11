import { motion } from 'motion/react';
import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  addDays,
  bmi,
  bmiCategory,
  cmToDisplay,
  daysToGoal,
  formatDay,
  formatHeight,
  healthyWeightRange,
  kgToDisplay,
  lengthUnit,
  navyBodyFat,
  slopePerDay,
  todayISO,
  weightTrend,
  weightUnit,
  type Measurement,
  type Profile,
} from '@fettle/shared';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { PageHeader, Stat } from '../components/Bits';
import { Card, EmptyState } from '../components/Card';
import { Chart, tooltipBase, type ChartTheme } from '../components/charts/Chart';
import { Button } from '../components/ui/Button';
import { Segmented } from '../components/ui/Segmented';
import { useUi } from '../components/UiProvider';
import { api } from '../lib/api';
import { useHealthMutation, useMeasurements, useProfile, useUnits, useWeights } from '../lib/queries';
import { fmt } from '../lib/utils';

type Span = '30' | '90' | '365' | 'all';

export function BodyPage() {
  const { open } = useUi();
  const { data: profile } = useProfile();
  const units = useUnits();
  const { data: weights } = useWeights();
  const [span, setSpan] = useState<Span>('90');

  const trend = useMemo(() => weightTrend(weights?.map((w) => ({ day: w.measuredOn, weightKg: w.weightKg })) ?? []), [weights]);
  if (!profile) return null;

  const latest = trend.at(-1);
  const first = trend[0];
  const recent = trend.filter((p) => p.day >= addDays(todayISO(), -28));
  const slope = slopePerDay(recent.map((p) => ({ day: p.day, value: p.trendKg })));
  const toGoal = latest && profile.targetWeightKg ? daysToGoal(latest.trendKg, profile.targetWeightKg, slope) : null;
  const w = (kg: number) => kgToDisplay(kg, units);
  const unit = weightUnit(units);

  return (
    <div>
      <PageHeader
        title="Body"
        emoji="⚖️"
        subtitle="Your trend matters more than any single weigh-in."
        actions={
          <>
            <Button onClick={() => open({ kind: 'measurement' })}>📏 Measure</Button>
            <Button variant="primary" onClick={() => open({ kind: 'weight' })}>
              <Plus className="size-4" /> Weigh in
            </Button>
          </>
        }
      />

      {!latest ? (
        <Card>
          <EmptyState icon="⚖️" title="No weigh-ins yet">
            Weigh in a few times a week and Fettle will smooth out the daily noise.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-12">
          <Card className="lg:col-span-4" bodyClassName="space-y-4">
            <div>
              <div className="text-sm text-ink-3">Trend weight</div>
              <div className="flex items-baseline gap-2">
                <AnimatedNumber value={w(latest.trendKg)} decimals={1} format={(v) => v.toFixed(1)} className="display num text-5xl font-semibold text-weight" />
                <span className="text-ink-3">{unit}</span>
              </div>
              <div className="mt-1 text-sm text-ink-2">
                Last weigh-in {w(latest.weightKg)} {unit} · {formatDay(latest.day)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Stat
                label="Since start"
                value={`${latest.trendKg - first!.weightKg > 0 ? '+' : ''}${(w(latest.trendKg) - w(first!.weightKg)).toFixed(1)}`}
                unit={unit}
                color={(latest.trendKg - first!.weightKg) * (profile.goal === 'gain' ? 1 : -1) >= 0 ? 'var(--good)' : 'var(--warn)'}
              />
              <Stat label="Weekly pace" value={slope === null ? '—' : `${slope * 7 > 0 ? '+' : ''}${(w(slope * 7)).toFixed(2)}`} unit={slope === null ? undefined : unit} />
              {profile.targetWeightKg && <Stat label="Goal" value={w(profile.targetWeightKg)} unit={unit} sub={toGoal ? `~${formatDay(addDays(todayISO(), toGoal), { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Keep logging'} />}
              <BmiStat weightKg={latest.trendKg} heightCm={profile.heightCm} />
            </div>
          </Card>

          <Card
            className="lg:col-span-8"
            title="Weight over time"
            subtitle="Dots are weigh-ins, the line is your smoothed trend"
            delay={0.05}
            action={
              <Segmented
                size="sm"
                value={span}
                onChange={setSpan}
                options={[
                  { value: '30', label: '1M' },
                  { value: '90', label: '3M' },
                  { value: '365', label: '1Y' },
                  { value: 'all', label: 'All' },
                ]}
              />
            }
          >
            <WeightChart trend={trend} span={span} profile={profile} />
          </Card>

          <WeighIns />
          <Measurements profile={profile} />
        </div>
      )}
    </div>
  );
}

function BmiStat({ weightKg, heightCm }: { weightKg: number; heightCm: number }) {
  const value = bmi(weightKg, heightCm);
  const cat = bmiCategory(value);
  const color = { low: 'var(--c-water)', good: 'var(--good)', warn: 'var(--warn)', high: 'var(--bad)' }[cat.tone];
  return <Stat label="BMI" value={value.toFixed(1)} sub={cat.label} color={color} />;
}

function WeightChart({ trend, span, profile }: { trend: ReturnType<typeof weightTrend>; span: Span; profile: Profile }) {
  const units = useUnits();
  const from = span === 'all' ? '0000' : addDays(todayISO(), -Number(span));
  const points = trend.filter((p) => p.day >= from);
  const [lo, hi] = healthyWeightRange(profile.heightCm);
  const option = (t: ChartTheme) => {
    const w = (kg: number) => kgToDisplay(kg, units);
    const values = points.flatMap((p) => [w(p.weightKg), w(p.trendKg)]);
    if (profile.targetWeightKg) values.push(w(profile.targetWeightKg));
    const min = Math.floor(Math.min(...values) - 1);
    const max = Math.ceil(Math.max(...values) + 1);
    return {
      tooltip: { ...tooltipBase(t), trigger: 'axis', valueFormatter: (v: number) => `${v?.toFixed(1)} ${weightUnit(units)}` },
      grid: { left: 8, right: 16, top: 16, bottom: 4, containLabel: true },
      xAxis: { type: 'time', axisLine: { lineStyle: { color: t.axis } }, axisLabel: { color: t.text3, fontSize: 11, hideOverlap: true }, splitLine: { show: false } },
      yAxis: { type: 'value', min, max, splitNumber: 4, axisLabel: { color: t.text3, fontSize: 11 }, splitLine: { lineStyle: { color: t.grid, type: 'dashed' } } },
      series: [
        {
          type: 'scatter',
          name: 'Weigh-in',
          symbolSize: 7,
          itemStyle: { color: t.mix(t.c('weight'), t.surface, 0.45) },
          data: points.map((p) => [p.day, w(p.weightKg)]),
        },
        {
          type: 'line',
          name: 'Trend',
          smooth: 0.3,
          showSymbol: false,
          lineStyle: { width: 3, color: t.c('weight') },
          areaStyle: {
            color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: t.mix(t.c('weight'), t.surface, 0.3) }, { offset: 1, color: t.surface }] },
          },
          data: points.map((p) => [p.day, w(p.trendKg)]),
          markArea: { silent: true, itemStyle: { color: t.mix(t.c('move'), t.surface, 0.07) }, data: [[{ yAxis: w(lo) }, { yAxis: w(hi) }]] },
          markLine: profile.targetWeightKg
            ? { symbol: 'none', silent: true, lineStyle: { color: t.c('energy'), type: 'dashed' }, label: { formatter: 'Goal', color: t.c('energy'), fontSize: 10 }, data: [{ yAxis: w(profile.targetWeightKg) }] }
            : undefined,
        },
      ],
    };
  };
  return <Chart option={option} height={300} ariaLabel="Weight and smoothed trend over time, with the healthy BMI band shaded" />;
}

function WeighIns() {
  const units = useUnits();
  const { data } = useWeights();
  const remove = useHealthMutation((id: string) => api.deleteWeight(id), { success: 'Weigh-in deleted' });
  const rows = [...(data ?? [])].reverse().slice(0, 30);
  return (
    <Card className="lg:col-span-5" title="Weigh-ins" delay={0.08}>
      <ul className="max-h-[320px] space-y-0.5 overflow-y-auto">
        {rows.map((r, i) => {
          const prev = rows[i + 1];
          const diff = prev ? kgToDisplay(r.weightKg, units) - kgToDisplay(prev.weightKg, units) : null;
          return (
            <li key={r.id} className="group flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2">
              <span className="flex-1 text-sm text-ink-2">{formatDay(r.measuredOn)}</span>
              {r.bodyFatPct && <span className="text-xs text-ink-3">{r.bodyFatPct}% fat</span>}
              {diff !== null && (
                <span className="num w-12 text-right text-xs" style={{ color: diff > 0 ? 'var(--warn)' : diff < 0 ? 'var(--good)' : undefined }}>
                  {diff > 0 ? '+' : ''}
                  {diff.toFixed(1)}
                </span>
              )}
              <span className="num w-20 text-right font-semibold">
                {kgToDisplay(r.weightKg, units)} <span className="text-xs font-normal text-ink-3">{weightUnit(units)}</span>
              </span>
              <button onClick={() => remove.mutate(r.id)} className="rounded-lg p-1 text-ink-3 opacity-0 hover:text-bad group-hover:opacity-100" aria-label="Delete weigh-in">
                <Trash2 className="size-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

const PARTS: Array<[keyof Measurement, string]> = [
  ['waistCm', 'Waist'],
  ['hipsCm', 'Hips'],
  ['chestCm', 'Chest'],
  ['neckCm', 'Neck'],
  ['armCm', 'Arm'],
  ['thighCm', 'Thigh'],
];

function Measurements({ profile }: { profile: Profile }) {
  const units = useUnits();
  const { open } = useUi();
  const { data } = useMeasurements();
  const latest = data?.at(-1);
  const first = data?.[0];
  const bodyFat = latest?.neckCm && latest.waistCm ? navyBodyFat(profile.sex, profile.heightCm, latest.neckCm, latest.waistCm, latest.hipsCm) : null;
  const whr = latest?.waistCm && latest.hipsCm ? latest.waistCm / latest.hipsCm : null;
  const whtr = latest?.waistCm ? latest.waistCm / profile.heightCm : null;

  return (
    <Card className="lg:col-span-7" title="Measurements" subtitle={`Height ${formatHeight(profile.heightCm, units)}`} delay={0.1} action={<Button size="sm" onClick={() => open({ kind: 'measurement' })}>Add</Button>}>
      {!latest ? (
        <EmptyState icon="📏" title="No measurements yet">
          Inches lost often show up before kilos do.
        </EmptyState>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-2">
            <Stat label="Body fat (Navy)" value={bodyFat ? `${bodyFat}%` : '—'} sub={bodyFat ? 'estimate' : 'needs neck + waist' + (profile.sex === 'female' ? ' + hips' : '')} color="var(--c-weight)" />
            <Stat label="Waist : height" value={whtr ? whtr.toFixed(2) : '—'} sub={whtr ? (whtr < 0.5 ? 'Healthy (< 0.5)' : 'Aim under 0.5') : undefined} color={whtr ? (whtr < 0.5 ? 'var(--good)' : 'var(--warn)') : undefined} />
            <Stat label="Waist : hip" value={whr ? whr.toFixed(2) : '—'} />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PARTS.map(([key, label], i) => {
              const now = latest[key] as number | null;
              const then = first && first !== latest ? (first[key] as number | null) : null;
              const diff = now !== null && then !== null ? cmToDisplay(now, units) - cmToDisplay(then, units) : null;
              return (
                <motion.div key={key} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }} className="rounded-2xl border border-line px-3 py-2.5">
                  <div className="text-xs text-ink-3">{label}</div>
                  <div className="num font-semibold">
                    {now !== null ? `${cmToDisplay(now, units)} ${lengthUnit(units)}` : '—'}
                    {diff !== null && diff !== 0 && <span className="ml-1.5 text-xs font-normal text-ink-3">{diff > 0 ? '+' : ''}{fmt(diff, 1)}</span>}
                  </div>
                </motion.div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-ink-3">Latest from {formatDay(latest.measuredOn)}{first && first !== latest ? `, compared with ${formatDay(first.measuredOn)}` : ''}.</p>
        </>
      )}
    </Card>
  );
}
