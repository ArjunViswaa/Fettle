import { motion } from 'motion/react';
import { Plus } from 'lucide-react';
import {
  addDays,
  distanceUnit,
  formatDay,
  kmToDisplay,
  relativeDay,
  stepDistanceKm,
  todayISO,
  WORKOUT_INFO,
  type Profile,
} from '@fettle/shared';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { PageHeader, Stat } from '../components/Bits';
import { Card, EmptyState } from '../components/Card';
import { Chart, dayAxes, tooltipBase, type ChartTheme } from '../components/charts/Chart';
import { ProgressRing } from '../components/Rings';
import { Button } from '../components/ui/Button';
import { useUi } from '../components/UiProvider';
import { useDaily, useProfile, useToday, useUnits, useWorkouts } from '../lib/queries';
import { fmt } from '../lib/utils';

export function ActivityPage() {
  const { open } = useUi();
  const { data: profile } = useProfile();
  if (!profile) return null;
  return (
    <div>
      <PageHeader
        title="Activity"
        emoji="🏃"
        subtitle="Steps, workouts and active minutes."
        actions={
          <>
            <Button onClick={() => open({ kind: 'steps' })}>👟 Steps</Button>
            <Button variant="primary" onClick={() => open({ kind: 'workout' })}>
              <Plus className="size-4" /> Workout
            </Button>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-12">
        <TodayCard profile={profile} />
        <WeekCard profile={profile} />
        <StepsChart profile={profile} />
        <WorkoutsCard />
        <Heatmap profile={profile} />
      </div>
    </div>
  );
}

function TodayCard({ profile }: { profile: Profile }) {
  const units = useUnits();
  const { open } = useUi();
  const { data } = useToday(todayISO());
  const steps = data?.steps?.steps ?? 0;
  const km = stepDistanceKm(steps, profile.heightCm);
  return (
    <Card className="lg:col-span-5" title="Today" bodyClassName="flex items-center gap-6">
      <button onClick={() => open({ kind: 'steps' })} aria-label="Update today's steps">
        <ProgressRing value={steps} target={profile.stepTarget} color="var(--c-move)" size={160} stroke={15}>
          <span className="text-xl">👟</span>
          <AnimatedNumber value={steps} format={(v) => fmt(v)} className="display num text-3xl font-semibold" />
          <span className="text-xs text-ink-3">of {fmt(profile.stepTarget)}</span>
        </ProgressRing>
      </button>
      <div className="grid flex-1 grid-cols-1 gap-2">
        <Stat label="Distance" value={kmToDisplay(km, units)} unit={distanceUnit(units)} color="var(--c-move)" />
        <Stat label="Active minutes" value={data?.activeMinutes ?? 0} unit={`/ ${profile.activeMinutesTarget}`} color="var(--c-active)" />
        <Stat label="Calories burned" value={fmt(data?.burned.total ?? 0)} unit="kcal" color="var(--c-energy)" />
      </div>
    </Card>
  );
}

function WeekCard({ profile }: { profile: Profile }) {
  const { data } = useDaily(7);
  const active = data?.reduce((a, d) => a + (d.activeMinutes ?? 0), 0) ?? 0;
  const steps = data?.reduce((a, d) => a + (d.steps ?? 0), 0) ?? 0;
  const goalDays = data?.filter((d) => (d.steps ?? 0) >= profile.stepTarget).length ?? 0;
  const who = Math.min(active / 150, 1);
  return (
    <Card className="lg:col-span-7" title="Last 7 days" subtitle="The WHO recommends at least 150 active minutes a week" delay={0.05}>
      <div className="mb-4 h-3 overflow-hidden rounded-full bg-[var(--track)]">
        <motion.div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, var(--c-active), var(--c-move))' }} initial={{ width: 0 }} animate={{ width: `${who * 100}%` }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Active minutes" value={active} unit="/ 150" sub={who >= 1 ? 'WHO goal met 🎉' : `${150 - active} to go`} />
        <Stat label="Total steps" value={fmt(steps)} />
        <Stat label="Daily average" value={fmt(steps / 7)} unit="steps" />
        <Stat label="Step goal hit" value={goalDays} unit="/ 7 days" />
      </div>
    </Card>
  );
}

function StepsChart({ profile }: { profile: Profile }) {
  const { data } = useDaily(30);
  const option = (t: ChartTheme) => ({
    tooltip: { ...tooltipBase(t), trigger: 'axis', valueFormatter: (v: number) => `${fmt(v ?? 0)} steps` },
    ...dayAxes(t, data?.map((d) => d.day) ?? []),
    series: [
      {
        type: 'bar',
        name: 'Steps',
        barWidth: '62%',
        data: data?.map((d) => ({
          value: d.steps ?? 0,
          itemStyle: { color: (d.steps ?? 0) >= profile.stepTarget ? t.c('move') : t.mix(t.c('move'), t.surface2, 0.45), borderRadius: [6, 6, 2, 2] },
        })),
        markLine: {
          symbol: 'none',
          silent: true,
          lineStyle: { color: t.text3, type: 'dashed' },
          label: { formatter: 'Goal', color: t.text3, fontSize: 10 },
          data: [{ yAxis: profile.stepTarget }],
        },
      },
    ],
  });
  return (
    <Card className="lg:col-span-7" title="Steps, last 30 days" delay={0.08}>
      {data ? <Chart option={option} height={260} ariaLabel="Daily steps for the last 30 days" /> : <div className="skeleton h-[260px]" />}
    </Card>
  );
}

function WorkoutsCard() {
  const { open } = useUi();
  const units = useUnits();
  const { data } = useWorkouts(60);
  return (
    <Card className="lg:col-span-5" title="Recent workouts" subtitle="Tap one to edit" delay={0.1}>
      {!data?.length ? (
        <EmptyState icon="🏁" title="No workouts yet">
          Walks count too. Log your first one and earn a badge.
        </EmptyState>
      ) : (
        <ul className="max-h-[300px] space-y-1 overflow-y-auto">
          {data.map((w, i) => (
            <motion.li key={w.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }}>
              <button onClick={() => open({ kind: 'workout', workout: w })} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-surface-2">
                <span className="flex size-10 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--c-move)_14%,transparent)] text-xl">{WORKOUT_INFO[w.type].emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{w.title || WORKOUT_INFO[w.type].label}</span>
                  <span className="block text-xs text-ink-3">
                    {relativeDay(w.performedOn)} · {w.durationMin} min · {w.intensity}
                    {w.distanceKm ? ` · ${kmToDisplay(w.distanceKm, units)} ${distanceUnit(units)}` : ''}
                  </span>
                </span>
                <span className="num text-sm font-semibold text-energy">{fmt(w.caloriesBurned)} kcal</span>
              </button>
            </motion.li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Heatmap({ profile }: { profile: Profile }) {
  const today = todayISO();
  const { data } = useDaily(182, today);
  const option = (t: ChartTheme) => ({
    tooltip: {
      ...tooltipBase(t),
      formatter: (p: { value: [string, number] }) => `${formatDay(p.value[0])}<br/><b>${fmt(p.value[1])}</b> steps`,
    },
    visualMap: {
      show: false,
      min: 0,
      max: profile.stepTarget,
      inRange: { color: [t.surface2, t.mix(t.c('move'), t.surface2, 0.4), t.c('move')] },
    },
    calendar: {
      range: [addDays(today, -181), today],
      top: 24,
      left: 30,
      right: 8,
      bottom: 4,
      cellSize: ['auto', 15],
      splitLine: { show: false },
      itemStyle: { borderColor: t.surface, borderWidth: 3, color: t.surface2 },
      dayLabel: { color: t.text3, fontSize: 10, firstDay: 1, nameMap: ['S', 'M', 'T', 'W', 'T', 'F', 'S'] },
      monthLabel: { color: t.text3, fontSize: 11 },
      yearLabel: { show: false },
    },
    series: [{ type: 'heatmap', coordinateSystem: 'calendar', data: data?.map((d) => [d.day, d.steps ?? 0]) ?? [] }],
  });
  return (
    <Card className="lg:col-span-12" title="Six months of steps" subtitle="Brighter days hit your goal" delay={0.12}>
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">{data ? <Chart option={option} height={170} ariaLabel="Calendar heatmap of daily steps" /> : <div className="skeleton h-[170px]" />}</div>
      </div>
    </Card>
  );
}
