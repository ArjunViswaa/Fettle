import { Plus, Trash2 } from 'lucide-react';
import { addDays, clockMinutes, eachDay, formatClock, formatDay, minutesToHM, todayISO, type Profile, type SleepEntry } from '@fettle/shared';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { PageHeader, Stat } from '../components/Bits';
import { Card, EmptyState } from '../components/Card';
import { Chart, dayAxes, tooltipBase, type ChartTheme } from '../components/charts/Chart';
import { ProgressRing } from '../components/Rings';
import { Button } from '../components/ui/Button';
import { useUi } from '../components/UiProvider';
import { api } from '../lib/api';
import { useHealthMutation, useProfile, useSleep } from '../lib/queries';

const QUALITY = ['', '😵', '🥱', '😐', '😌', '🤩'];

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const stdev = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

export function SleepPage() {
  const { open } = useUi();
  const { data: profile } = useProfile();
  const { data } = useSleep(30);
  if (!profile) return null;

  const nights = data ?? [];
  const last = nights.at(-1);
  const week = nights.filter((n) => n.sleptOn > addDays(todayISO(), -7));
  const debt = week.reduce((a, n) => a + (profile.sleepTargetMinutes - n.minutes), 0);
  const bedtimes = nights.map((n) => clockMinutes(n.bedAt, { lateNight: true }));
  const wakes = nights.map((n) => clockMinutes(n.wakeAt));
  // Consistency: 100 when bedtimes vary by under 15 minutes, falling to 0 at two hours.
  const consistency = nights.length >= 3 ? Math.round(Math.max(0, Math.min(1, 1 - (stdev(bedtimes) - 15) / 105)) * 100) : null;

  return (
    <div>
      <PageHeader
        title="Sleep"
        emoji="🌙"
        subtitle="Regular sleep is the foundation everything else stands on."
        actions={
          <Button variant="primary" onClick={() => open({ kind: 'sleep' })}>
            <Plus className="size-4" /> Log sleep
          </Button>
        }
      />
      {!nights.length ? (
        <Card>
          <EmptyState icon="😴" title="No nights logged yet">
            Log when you went to bed and woke up. A week of data unlocks your consistency score.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-12">
          <Card className="relative lg:col-span-5" bodyClassName="flex items-center gap-6">
            <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-[var(--c-sleep)] opacity-20 blur-3xl" />
            <ProgressRing value={last!.minutes} target={profile.sleepTargetMinutes} color="var(--c-sleep)" size={160} stroke={15}>
              <span className="text-2xl">{QUALITY[last!.quality]}</span>
              <span className="display num text-2xl font-semibold">{minutesToHM(last!.minutes)}</span>
              <span className="text-xs text-ink-3">of {minutesToHM(profile.sleepTargetMinutes)}</span>
            </ProgressRing>
            <div className="space-y-2 text-sm">
              <div className="text-ink-3">{formatDay(last!.sleptOn)}</div>
              <div>
                🛏️ {formatClock(clockMinutes(last!.bedAt))} → ☀️ {formatClock(clockMinutes(last!.wakeAt))}
              </div>
              <div className="text-ink-2">{last!.awakenings ? `Woke ${last!.awakenings}× in the night` : 'Slept through'}</div>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-4 lg:col-span-7 lg:grid-cols-4">
            <Stat label="30-day average" value={minutesToHM(mean(nights.map((n) => n.minutes)))} color="var(--c-sleep)" />
            <Stat label="Avg bedtime" value={formatClock(mean(bedtimes))} />
            <Stat label="Avg wake-up" value={formatClock(mean(wakes))} />
            <div className="rounded-2xl border border-line bg-surface-2/60 p-3.5">
              <div className="text-xs font-medium text-ink-3">Consistency</div>
              <div className="display num mt-1 text-2xl font-semibold">{consistency === null ? '—' : <AnimatedNumber value={consistency} format={(v) => `${v}`} />}</div>
              <div className="mt-0.5 text-xs text-ink-3">{consistency === null ? 'Needs 3 nights' : consistency >= 75 ? 'Rock steady' : 'Try a fixed bedtime'}</div>
            </div>
            <div className="col-span-2 rounded-2xl border border-line bg-surface-2/60 p-3.5 lg:col-span-4">
              <div className="text-xs font-medium text-ink-3">Sleep debt, last 7 nights</div>
              <div className="display num mt-1 text-2xl font-semibold" style={{ color: debt > 60 ? 'var(--warn)' : 'var(--good)' }}>
                {debt > 0 ? minutesToHM(debt) : 'None 🎉'}
              </div>
              <div className="mt-0.5 text-xs text-ink-3">{debt > 60 ? 'An early night or two will pay it back.' : 'You are well rested.'}</div>
            </div>
          </div>

          <Card className="lg:col-span-7" title="Duration" subtitle="Last 30 nights" delay={0.05}>
            <DurationChart nights={nights} profile={profile} />
          </Card>
          <Card className="lg:col-span-5" title="Sleep window" subtitle="When you were asleep, night by night" delay={0.08}>
            <WindowChart nights={nights.slice(-14)} />
          </Card>
          <NightsList nights={nights} />
        </div>
      )}
    </div>
  );
}

function DurationChart({ nights, profile }: { nights: SleepEntry[]; profile: Profile }) {
  const days = eachDay(addDays(todayISO(), -29), todayISO());
  const byDay = new Map(nights.map((n) => [n.sleptOn, n]));
  const option = (t: ChartTheme) => ({
    tooltip: { ...tooltipBase(t), trigger: 'axis', valueFormatter: (v: number) => (v ? `${(v / 60).toFixed(1)} h` : '—') },
    ...dayAxes(t, days),
    yAxis: { type: 'value', axisLabel: { color: t.text3, fontSize: 11, formatter: (v: number) => `${v / 60}h` }, splitLine: { lineStyle: { color: t.grid, type: 'dashed' } }, interval: 120 },
    series: [
      {
        type: 'bar',
        barWidth: '60%',
        data: days.map((d) => {
          const n = byDay.get(d);
          return { value: n?.minutes ?? 0, itemStyle: { color: n && n.minutes >= profile.sleepTargetMinutes ? t.c('sleep') : t.mix(t.c('sleep'), t.surface2, 0.5), borderRadius: [6, 6, 2, 2] } };
        }),
        markLine: { symbol: 'none', silent: true, lineStyle: { color: t.text3, type: 'dashed' }, label: { formatter: 'Goal', color: t.text3, fontSize: 10 }, data: [{ yAxis: profile.sleepTargetMinutes }] },
      },
    ],
  });
  return <Chart option={option} height={240} ariaLabel="Hours slept each night for 30 nights" />;
}

/** Floating bars from bedtime to wake time, on a clock axis from 8pm to noon. */
function WindowChart({ nights }: { nights: SleepEntry[] }) {
  const option = (t: ChartTheme) => {
    const base = 20 * 60; // 8pm
    const rel = (iso: string) => {
      const m = clockMinutes(iso);
      return m >= base ? m - base : m + 1440 - base;
    };
    return {
      tooltip: {
        ...tooltipBase(t),
        trigger: 'axis',
        formatter: (ps: Array<{ dataIndex: number }>) => {
          const n = nights[ps[0]!.dataIndex]!;
          return `${formatDay(n.sleptOn)}<br/>${formatClock(clockMinutes(n.bedAt))} → ${formatClock(clockMinutes(n.wakeAt))}`;
        },
      },
      grid: { left: 8, right: 12, top: 8, bottom: 4, containLabel: true },
      xAxis: { type: 'category', data: nights.map((n) => n.sleptOn), axisLabel: { color: t.text3, fontSize: 10, formatter: (d: string) => new Date(`${d}T12:00`).toLocaleDateString(undefined, { day: 'numeric' }) }, axisTick: { show: false }, axisLine: { lineStyle: { color: t.axis } } },
      yAxis: { type: 'value', inverse: true, min: 0, max: 16 * 60, interval: 240, axisLabel: { color: t.text3, fontSize: 10, formatter: (v: number) => formatClock(v + base) }, splitLine: { lineStyle: { color: t.grid, type: 'dashed' } } },
      series: [
        { type: 'bar', stack: 'w', silent: true, itemStyle: { color: 'transparent' }, data: nights.map((n) => rel(n.bedAt)) },
        {
          type: 'bar',
          stack: 'w',
          barWidth: '55%',
          itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: t.c('sleep') }, { offset: 1, color: t.c('water') }] }, borderRadius: 8 },
          data: nights.map((n) => Math.max(0, rel(n.wakeAt) - rel(n.bedAt))),
        },
      ],
    };
  };
  return <Chart option={option} height={240} ariaLabel="Bedtime to wake-up window for recent nights" />;
}

function NightsList({ nights }: { nights: SleepEntry[] }) {
  const remove = useHealthMutation((id: string) => api.deleteSleep(id), { success: 'Night removed' });
  return (
    <Card className="lg:col-span-12" title="Nights" delay={0.1}>
      <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {[...nights].reverse().map((n) => (
          <div key={n.id} className="group flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2">
            <span className="text-xl">{QUALITY[n.quality]}</span>
            <span className="flex-1 text-sm">
              <span className="block">{formatDay(n.sleptOn)}</span>
              <span className="block text-xs text-ink-3">
                {formatClock(clockMinutes(n.bedAt))} – {formatClock(clockMinutes(n.wakeAt))}
              </span>
            </span>
            <span className="num font-semibold">{minutesToHM(n.minutes)}</span>
            <button onClick={() => remove.mutate(n.id)} className="rounded-lg p-1 text-ink-3 opacity-0 hover:text-bad group-hover:opacity-100" aria-label="Delete night">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}
