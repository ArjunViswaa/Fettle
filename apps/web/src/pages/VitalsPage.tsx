import { motion } from 'motion/react';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { celsiusToDisplay, VITAL_INFO, VITAL_KINDS, type Vital, type VitalKind } from '@fettle/shared';
import { PageHeader } from '../components/Bits';
import { Card, EmptyState } from '../components/Card';
import { Chart, tooltipBase, type ChartTheme } from '../components/charts/Chart';
import { Button } from '../components/ui/Button';
import { useUi } from '../components/UiProvider';
import { api } from '../lib/api';
import { useHealthMutation, useUnits, useVitals } from '../lib/queries';
import { cn } from '../lib/utils';

/** American Heart Association categories. */
function bloodPressureStatus(sys: number, dia: number) {
  if (sys >= 180 || dia >= 120) return { label: 'Crisis: seek care', tone: 'bad' as const };
  if (sys >= 140 || dia >= 90) return { label: 'High (stage 2)', tone: 'bad' as const };
  if (sys >= 130 || dia >= 80) return { label: 'High (stage 1)', tone: 'warn' as const };
  if (sys >= 120) return { label: 'Elevated', tone: 'warn' as const };
  if (sys < 90 || dia < 60) return { label: 'Low', tone: 'warn' as const };
  return { label: 'Normal', tone: 'good' as const };
}

function status(v: Vital) {
  if (v.kind === 'blood_pressure') return bloodPressureStatus(v.value, v.value2 ?? 0);
  const [lo, hi] = VITAL_INFO[v.kind].normal;
  if (v.kind === 'glucose' && v.context === 'fasting') {
    if (v.value >= 126) return { label: 'High (fasting)', tone: 'bad' as const };
    if (v.value >= 100) return { label: 'Elevated (fasting)', tone: 'warn' as const };
    if (v.value < 70) return { label: 'Low', tone: 'warn' as const };
    return { label: 'Normal', tone: 'good' as const };
  }
  if (v.value < lo) return { label: 'Below typical', tone: 'warn' as const };
  if (v.value > hi) return { label: 'Above typical', tone: 'warn' as const };
  return { label: 'In range', tone: 'good' as const };
}

export function VitalsPage() {
  const { open } = useUi();
  const units = useUnits();
  const { data } = useVitals(180);
  const [selected, setSelected] = useState<VitalKind>('heart_rate');
  const readings = data ?? [];

  const show = (v: Vital) => {
    if (v.kind === 'blood_pressure') return `${v.value}/${v.value2}`;
    if (v.kind === 'temperature') return String(celsiusToDisplay(v.value, units));
    return String(v.value);
  };
  const unit = (kind: VitalKind) => (kind === 'temperature' && units === 'imperial' ? '°F' : VITAL_INFO[kind].unit);

  return (
    <div>
      <PageHeader
        title="Vitals"
        emoji="❤️"
        subtitle="Readings from a cuff, a meter or your watch. Not a diagnosis: talk to a doctor about anything unusual."
        actions={
          <Button variant="primary" onClick={() => open({ kind: 'vital', vital: selected })}>
            <Plus className="size-4" /> Add reading
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {VITAL_KINDS.map((kind, i) => {
          const latest = readings.filter((r) => r.kind === kind).at(-1);
          const st = latest ? status(latest) : null;
          return (
            <motion.button
              key={kind}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -3 }}
              onClick={() => setSelected(kind)}
              className={cn('card p-4 text-left transition-colors', selected === kind && 'ring-2 ring-[var(--c-heart)]')}
            >
              <div className="flex items-center justify-between text-xs text-ink-3">
                {VITAL_INFO[kind].label}
                <span className="text-lg">{VITAL_INFO[kind].emoji}</span>
              </div>
              <div className="display num mt-2 text-2xl font-semibold">
                {latest ? show(latest) : '—'} <span className="text-xs font-normal text-ink-3">{unit(kind)}</span>
              </div>
              {st && <div className="mt-1 text-xs font-medium" style={{ color: `var(--${st.tone})` }}>{st.label}</div>}
            </motion.button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-8" title={VITAL_INFO[selected].label} subtitle="Shaded band shows the typical healthy range">
          <VitalChart kind={selected} readings={readings.filter((r) => r.kind === selected)} />
        </Card>
        <Card className="lg:col-span-4" title="Readings" delay={0.05}>
          <ReadingList readings={readings.filter((r) => r.kind === selected)} show={show} unit={unit(selected)} />
        </Card>
      </div>
    </div>
  );
}

function VitalChart({ kind, readings }: { kind: VitalKind; readings: Vital[] }) {
  const units = useUnits();
  if (!readings.length) return <EmptyState icon={VITAL_INFO[kind].emoji} title="No readings yet" />;
  const conv = (v: number) => (kind === 'temperature' ? celsiusToDisplay(v, units) : v);
  const info = VITAL_INFO[kind];
  const option = (t: ChartTheme) => ({
    tooltip: { ...tooltipBase(t), trigger: 'axis' },
    grid: { left: 8, right: 16, top: 16, bottom: 4, containLabel: true },
    xAxis: { type: 'time', axisLabel: { color: t.text3, fontSize: 11, hideOverlap: true }, axisLine: { lineStyle: { color: t.axis } }, splitLine: { show: false } },
    yAxis: { type: 'value', scale: true, axisLabel: { color: t.text3, fontSize: 11 }, splitLine: { lineStyle: { color: t.grid, type: 'dashed' } } },
    series: [
      {
        type: 'line',
        name: kind === 'blood_pressure' ? 'Systolic' : info.label,
        smooth: 0.3,
        symbolSize: 7,
        lineStyle: { width: 3, color: t.c('heart') },
        itemStyle: { color: t.c('heart') },
        data: readings.map((r) => [r.measuredAt, conv(r.value)]),
        markArea: { silent: true, itemStyle: { color: t.mix(t.c('move'), t.surface, 0.1) }, data: [[{ yAxis: conv(info.normal[0]) }, { yAxis: conv(info.normal[1]) }]] },
      },
      ...(kind === 'blood_pressure'
        ? [
            {
              type: 'line',
              name: 'Diastolic',
              smooth: 0.3,
              symbolSize: 7,
              lineStyle: { width: 3, color: t.c('fat') },
              itemStyle: { color: t.c('fat') },
              data: readings.map((r) => [r.measuredAt, r.value2]),
              markArea: { silent: true, itemStyle: { color: t.mix(t.c('fat'), t.surface, 0.1) }, data: [[{ yAxis: info.normal2![0] }, { yAxis: info.normal2![1] }]] },
            },
          ]
        : []),
    ],
  });
  return <Chart option={option} height={300} ariaLabel={`${info.label} readings over time`} />;
}

function ReadingList({ readings, show, unit }: { readings: Vital[]; show: (v: Vital) => string; unit: string }) {
  const remove = useHealthMutation((id: string) => api.deleteVital(id), { success: 'Reading deleted' });
  if (!readings.length) return <p className="py-8 text-center text-sm text-ink-3">Nothing here yet.</p>;
  return (
    <ul className="max-h-[300px] space-y-0.5 overflow-y-auto">
      {[...readings].reverse().map((r) => {
        const st = status(r);
        return (
          <li key={r.id} className="group flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2">
            <span className="size-2 rounded-full" style={{ background: `var(--${st.tone})` }} />
            <span className="flex-1 text-xs text-ink-3">
              {new Date(r.measuredAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
              {r.context && <span className="capitalize"> · {r.context.replace('_', ' ')}</span>}
            </span>
            <span className="num font-semibold">
              {show(r)} <span className="text-xs font-normal text-ink-3">{unit}</span>
            </span>
            <button onClick={() => remove.mutate(r.id)} className="rounded-lg p-1 text-ink-3 opacity-0 hover:text-bad group-hover:opacity-100" aria-label="Delete reading">
              <Trash2 className="size-3.5" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
