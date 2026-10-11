import { Link } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronRight, Flame, Minus, Plus } from 'lucide-react';
import {
  formatWater,
  kgToDisplay,
  MEAL_INFO,
  MEALS,
  minutesToHM,
  MOOD_INFO,
  todayISO,
  weightUnit,
  WORKOUT_INFO,
  type DaySummary,
  type Profile,
} from '@fettle/shared';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { DayNav, MeterBar } from '../components/Bits';
import { Card } from '../components/Card';
import { Chart, dayAxes, tooltipBase, type ChartTheme } from '../components/charts/Chart';
import { Rings } from '../components/Rings';
import { ScoreGauge } from '../components/ScoreGauge';
import { useUi } from '../components/UiProvider';
import { WaterGlass } from '../components/WaterGlass';
import { api } from '../lib/api';
import { useDaily, useHealthMutation, useMe, useProfile, useToday, useUnits } from '../lib/queries';
import { cn, fmt, greeting } from '../lib/utils';

export function TodayPage() {
  const { day, setDay } = useUi();
  const { data: me } = useMe();
  const { data: profile } = useProfile();
  const { data: summary } = useToday(day);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-ink-3">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          </motion.p>
          <h1 className="display mt-0.5 text-[28px] font-semibold sm:text-[34px]">
            {greeting()}, <span className="text-gradient">{me?.name?.split(' ')[0] ?? 'friend'}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {summary && summary.streak > 0 && <StreakBadge days={summary.streak} />}
          <DayNav day={day} onChange={setDay} />
        </div>
      </div>

      {!summary || !profile ? (
        <TodaySkeleton />
      ) : (
        <div className="grid gap-4 lg:grid-cols-12">
          <HeroRings summary={summary} profile={profile} />
          <ScoreCard summary={summary} />
          <MacrosCard summary={summary} profile={profile} />
          <WaterCard summary={summary} profile={profile} day={day} />
          <SnapshotTiles summary={summary} profile={profile} />
          <MealsCard summary={summary} />
          <HabitsCard summary={summary} day={day} />
          <WeekCard profile={profile} />
          <MedsCard summary={summary} day={day} />
        </div>
      )}
    </div>
  );
}

function StreakBadge({ days }: { days: number }) {
  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
      className="flex h-[42px] items-center gap-1.5 rounded-2xl border border-line bg-surface px-3 text-sm font-semibold"
      title="Days in a row with something logged"
    >
      <motion.span animate={{ rotate: [0, -8, 8, 0], scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 2.4, repeatDelay: 1.5 }}>
        <Flame className="size-4 text-energy" fill="currentColor" />
      </motion.span>
      <span className="num">{days}</span>
      <span className="font-normal text-ink-3">day{days === 1 ? '' : 's'}</span>
    </motion.div>
  );
}

function HeroRings({ summary, profile }: { summary: DaySummary; profile: Profile }) {
  const { open } = useUi();
  const eaten = summary.nutrition.calories;
  const budget = profile.calorieTarget + summary.burned.workouts;
  const left = budget - eaten;
  const rings = [
    { key: 'energy', label: 'Eaten', value: eaten, target: profile.calorieTarget, color: 'var(--c-energy)', unit: 'kcal' },
    { key: 'move', label: 'Steps', value: summary.steps?.steps ?? 0, target: profile.stepTarget, color: 'var(--c-move)', unit: '' },
    { key: 'water', label: 'Water', value: summary.waterMl, target: profile.waterTargetMl, color: 'var(--c-water)', unit: 'ml' },
    { key: 'active', label: 'Active', value: summary.activeMinutes, target: profile.activeMinutesTarget, color: 'var(--c-active)', unit: 'min' },
  ];

  return (
    <Card className="lg:col-span-8" bodyClassName="flex flex-col items-center gap-6 sm:flex-row sm:gap-10">
      <Rings rings={rings} size={236} stroke={20} gap={6}>
        <AnimatedNumber value={Math.abs(Math.round(left))} format={(v) => fmt(v)} className="display num text-4xl font-semibold" />
        <span className={cn('text-xs font-medium', left < 0 ? 'text-warn' : 'text-ink-3')}>{left < 0 ? 'kcal over' : 'kcal left'}</span>
      </Rings>
      <div className="w-full flex-1 space-y-3">
        {rings.map((r, i) => (
          <motion.button
            key={r.key}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + i * 0.07 }}
            onClick={() => open(r.key === 'energy' ? { kind: 'food' } : r.key === 'move' ? { kind: 'steps' } : r.key === 'active' ? { kind: 'workout' } : { kind: 'menu' })}
            className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-surface-2"
          >
            <span className="size-3 shrink-0 rounded-full" style={{ background: r.color, boxShadow: `0 0 12px ${r.color}` }} />
            <span className="flex-1 text-sm text-ink-2">{r.label}</span>
            <span className="num text-sm">
              <span className="font-semibold">{fmt(r.value)}</span>
              <span className="text-ink-3">
                {' '}
                / {fmt(r.target)} {r.unit}
              </span>
            </span>
            <span className="num w-11 text-right text-xs font-semibold" style={{ color: r.color }}>
              {Math.round((r.value / Math.max(1, r.target)) * 100)}%
            </span>
          </motion.button>
        ))}
        <div className="grid grid-cols-3 gap-2 pt-1 text-center">
          <MiniFigure label="Budget" value={budget} />
          <MiniFigure label="Food" value={eaten} />
          <MiniFigure label="Burned" value={summary.burned.total} />
        </div>
      </div>
    </Card>
  );
}

function MiniFigure({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-surface-2/70 py-2">
      <div className="num text-sm font-semibold">{fmt(value)}</div>
      <div className="text-[11px] text-ink-3">{label}</div>
    </div>
  );
}

function ScoreCard({ summary }: { summary: DaySummary }) {
  return (
    <Card className="lg:col-span-4" title="Fettle score" subtitle="Fills up as you look after yourself today" delay={0.05} bodyClassName="flex flex-col items-center">
      <ScoreGauge score={summary.score.total} size={210} />
      <div className="mt-5 w-full space-y-2">
        {summary.score.parts.map((p, i) => (
          <div key={p.key} className="flex items-center gap-3 text-xs">
            <span className="w-20 text-ink-3">{p.label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--track)]">
              <motion.div
                className="brand-gradient h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(p.points / p.max) * 100}%` }}
                transition={{ delay: 0.3 + i * 0.08, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <span className="num w-10 text-right text-ink-2">
              {p.points}/{p.max}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function MacrosCard({ summary, profile }: { summary: DaySummary; profile: Profile }) {
  const n = summary.nutrition;
  return (
    <Card className="lg:col-span-5" title="Macros" subtitle={`${fmt(n.calories)} of ${fmt(profile.calorieTarget)} kcal`} delay={0.08} action={<PageLink to="/nutrition" />}>
      <div className="space-y-4">
        <MeterBar label="Protein" value={n.proteinG} target={profile.proteinTargetG} color="var(--c-protein)" />
        <MeterBar label="Carbs" value={n.carbsG} target={profile.carbsTargetG} color="var(--c-carbs)" />
        <MeterBar label="Fat" value={n.fatG} target={profile.fatTargetG} color="var(--c-fat)" />
        <MeterBar label="Fibre" value={n.fiberG} target={profile.fiberTargetG} color="var(--c-move)" />
      </div>
    </Card>
  );
}

function WaterCard({ summary, profile, day }: { summary: DaySummary; profile: Profile; day: string }) {
  const units = useUnits();
  const add = useHealthMutation((ml: number) => api.addWater(day, ml));
  const fraction = summary.waterMl / profile.waterTargetMl;
  return (
    <Card className="lg:col-span-3" title="Hydration" delay={0.1} bodyClassName="flex flex-col items-center gap-3">
      <div className="relative">
        <WaterGlass fraction={fraction} />
        <AnimatePresence>
          {fraction >= 1 && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -right-2 -top-2 rounded-full bg-[var(--c-water)] p-1 text-white">
              <Check className="size-3.5" strokeWidth={3} />
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <div className="text-center">
        <div className="num font-semibold">{formatWater(summary.waterMl, units)}</div>
        <div className="text-xs text-ink-3">of {formatWater(profile.waterTargetMl, units)}</div>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          className="flex size-9 items-center justify-center rounded-xl border border-line bg-surface-2 text-ink-2 hover:text-ink disabled:opacity-40"
          onClick={() => add.mutate(-250)}
          disabled={summary.waterMl < 250 || add.isPending}
          aria-label="Remove a glass"
        >
          <Minus className="size-4" />
        </button>
        <motion.button
          whileTap={{ scale: 0.92 }}
          className="flex h-9 items-center gap-1.5 rounded-xl bg-[color-mix(in_oklab,var(--c-water)_18%,transparent)] px-3 text-sm font-semibold text-water"
          onClick={() => add.mutate(250)}
          disabled={add.isPending}
        >
          <Plus className="size-4" /> Glass
        </motion.button>
        <motion.button whileTap={{ scale: 0.92 }} className="h-9 rounded-xl border border-line px-2.5 text-xs text-ink-2 hover:text-ink" onClick={() => add.mutate(500)} disabled={add.isPending}>
          +{formatWater(500, units)}
        </motion.button>
      </div>
    </Card>
  );
}

function SnapshotTiles({ summary, profile }: { summary: DaySummary; profile: Profile }) {
  const { open } = useUi();
  const units = useUnits();
  const latest = summary.weight.latest;
  const prev = summary.weight.previous;
  const delta = latest && prev ? kgToDisplay(latest.weightKg, units) - kgToDisplay(prev.weightKg, units) : null;
  const mood = summary.mood ? MOOD_INFO[summary.mood.mood - 1] : null;

  const tiles = [
    {
      key: 'sleep',
      emoji: '🌙',
      label: 'Sleep',
      color: 'var(--c-sleep)',
      value: summary.sleep ? minutesToHM(summary.sleep.minutes) : 'Log it',
      sub: summary.sleep ? `${Math.round((summary.sleep.minutes / profile.sleepTargetMinutes) * 100)}% of goal` : 'How did you sleep?',
      onClick: () => open({ kind: 'sleep' }),
    },
    {
      key: 'weight',
      emoji: '⚖️',
      label: 'Weight',
      color: 'var(--c-weight)',
      value: latest ? `${kgToDisplay(latest.weightKg, units)} ${weightUnit(units)}` : 'Weigh in',
      sub: delta === null ? (latest ? 'First weigh-in' : 'Track your trend') : `${delta > 0 ? '▲' : delta < 0 ? '▼' : '='} ${Math.abs(delta).toFixed(1)} since last`,
      onClick: () => open({ kind: 'weight' }),
    },
    {
      key: 'mood',
      emoji: mood?.emoji ?? '🙂',
      label: 'Mood',
      color: 'var(--c-mind)',
      value: mood ? mood.label : 'Check in',
      sub: summary.mindfulMinutes ? `${summary.mindfulMinutes} mindful min` : 'How are you feeling?',
      onClick: () => open({ kind: 'mood' }),
    },
    {
      key: 'workouts',
      emoji: summary.workouts[0] ? WORKOUT_INFO[summary.workouts[0].type].emoji : '🏃',
      label: 'Workouts',
      color: 'var(--c-move)',
      value: summary.workouts.length ? `${fmt(summary.burned.workouts)} kcal` : 'Move',
      sub: summary.workouts.length ? `${summary.workouts.length} session${summary.workouts.length > 1 ? 's' : ''}, ${summary.workouts.reduce((a, w) => a + w.durationMin, 0)} min` : 'Log a workout',
      onClick: () => open({ kind: 'workout' }),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:col-span-4">
      {tiles.map((t, i) => (
        <motion.button
          key={t.key}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.97 }}
          onClick={t.onClick}
          className="card relative overflow-hidden p-4 text-left"
        >
          <div className="pointer-events-none absolute -right-6 -top-6 size-20 rounded-full opacity-25 blur-2xl" style={{ background: t.color }} />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-3">{t.label}</span>
            <span className="text-xl">{t.emoji}</span>
          </div>
          <div className="display num mt-3 text-lg font-semibold leading-tight">{t.value}</div>
          <div className="mt-0.5 text-[11px] text-ink-3">{t.sub}</div>
        </motion.button>
      ))}
    </div>
  );
}

function MealsCard({ summary }: { summary: DaySummary }) {
  const { open } = useUi();
  return (
    <Card className="lg:col-span-4" title="Meals" delay={0.14} action={<PageLink to="/nutrition" />}>
      <div className="space-y-1.5">
        {MEALS.map((meal) => {
          const m = summary.nutrition.byMeal[meal];
          return (
            <button key={meal} onClick={() => open({ kind: 'food', meal })} className="group flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-surface-2">
              <span className="flex size-10 items-center justify-center rounded-xl bg-surface-2 text-lg group-hover:bg-surface-3">{MEAL_INFO[meal].emoji}</span>
              <span className="flex-1">
                <span className="block text-sm font-medium">{MEAL_INFO[meal].label}</span>
                <span className="block text-xs text-ink-3">{m.count ? `${m.count} item${m.count > 1 ? 's' : ''} · P ${fmt(m.proteinG)}g` : 'Nothing yet'}</span>
              </span>
              <span className="num text-sm font-semibold">{m.calories ? fmt(m.calories) : ''}</span>
              <Plus className="size-4 text-ink-3 group-hover:text-energy" />
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function HabitsCard({ summary, day }: { summary: DaySummary; day: string }) {
  const checkin = useHealthMutation(({ id, count }: { id: string; count: number }) => api.checkin(id, day, count));
  const done = summary.habits.filter((h) => h.count >= h.targetPerDay).length;
  return (
    <Card className="lg:col-span-4" title="Habits" subtitle={summary.habits.length ? `${done} of ${summary.habits.length} done` : undefined} delay={0.16} action={<PageLink to="/habits" />}>
      {summary.habits.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-3">
          No habits yet. <Link to="/habits" className="text-brand underline-offset-2 hover:underline">Add one</Link>
        </p>
      ) : (
        <div className="space-y-1.5">
          {summary.habits.map((h) => {
            const complete = h.count >= h.targetPerDay;
            return (
              <button
                key={h.id}
                onClick={() => checkin.mutate({ id: h.id, count: complete ? 0 : h.count + 1 })}
                className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-surface-2"
              >
                <motion.span
                  animate={{ background: complete ? h.color : 'transparent', borderColor: h.color, scale: complete ? [1, 1.25, 1] : 1 }}
                  transition={{ duration: 0.35 }}
                  className="flex size-7 shrink-0 items-center justify-center rounded-full border-2"
                >
                  {complete && <Check className="size-4 text-white" strokeWidth={3} />}
                </motion.span>
                <span className="text-lg">{h.emoji}</span>
                <span className={cn('flex-1 text-sm', complete && 'text-ink-3 line-through decoration-2')}>{h.name}</span>
                {h.targetPerDay > 1 && (
                  <span className="num text-xs text-ink-3">
                    {h.count}/{h.targetPerDay}
                  </span>
                )}
                {h.streak > 1 && <span className="num text-xs text-energy">🔥{h.streak}</span>}
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function MedsCard({ summary, day }: { summary: DaySummary; day: string }) {
  const setDose = useHealthMutation(({ id, time, taken }: { id: string; time: string; taken: boolean }) => api.setDose(id, { day, time, status: taken ? 'taken' : 'pending' }));
  return (
    <Card className="lg:col-span-4" title="Medication & supplements" delay={0.2} action={<PageLink to="/meds" />}>
      {summary.doses.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-3">
          Nothing scheduled. <Link to="/meds" className="text-brand underline-offset-2 hover:underline">Add a reminder</Link>
        </p>
      ) : (
        <div className="space-y-1.5">
          {summary.doses.map((d) => {
            const taken = d.status === 'taken';
            return (
              <button key={`${d.medicationId}-${d.time}`} onClick={() => setDose.mutate({ id: d.medicationId, time: d.time, taken: !taken })} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-surface-2">
                <span className="num w-12 text-xs text-ink-3">{d.time}</span>
                <span className="size-2.5 rounded-full" style={{ background: d.color }} />
                <span className={cn('flex-1 text-sm', taken && 'text-ink-3 line-through')}>
                  {d.name} {d.dosage && <span className="text-ink-3">· {d.dosage}</span>}
                </span>
                <motion.span
                  animate={{ scale: taken ? [1, 1.2, 1] : 1 }}
                  className={cn('flex size-6 items-center justify-center rounded-lg border', taken ? 'border-transparent bg-good text-white' : 'border-line-strong')}
                >
                  {taken && <Check className="size-3.5" strokeWidth={3} />}
                </motion.span>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function WeekCard({ profile }: { profile: Profile }) {
  const { data } = useDaily(7, todayISO());
  const option = (t: ChartTheme) => {
    const days = data?.map((d) => d.day) ?? [];
    return {
      tooltip: { ...tooltipBase(t), trigger: 'axis', valueFormatter: (v: number) => `${fmt(v ?? 0)} kcal` },
      ...dayAxes(t, days),
      series: [
        {
          type: 'bar',
          name: 'Eaten',
          data: data?.map((d) => ({
            value: Math.round(d.calories ?? 0),
            itemStyle: {
              color: (d.calories ?? 0) > profile.calorieTarget * 1.1 ? t.c('active') : t.c('energy'),
              borderRadius: [8, 8, 3, 3],
            },
          })),
          barWidth: '46%',
          markLine: {
            symbol: 'none',
            silent: true,
            lineStyle: { color: t.text3, type: 'dashed' },
            label: { formatter: 'Goal', color: t.text3, fontSize: 10 },
            data: [{ yAxis: profile.calorieTarget }],
          },
        },
      ],
    };
  };
  return (
    <Card className="lg:col-span-4" title="This week" subtitle="Calories eaten vs your goal" delay={0.18} action={<PageLink to="/insights" />}>
      {data ? <Chart option={option} height={190} ariaLabel="Calories eaten each day this week" /> : <div className="skeleton h-[190px]" />}
    </Card>
  );
}

function PageLink({ to }: { to: string }) {
  return (
    <Link to={to} className="rounded-lg p-1 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Open">
      <ChevronRight className="size-4" />
    </Link>
  );
}

function TodaySkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <div className="skeleton h-[300px] lg:col-span-8" />
      <div className="skeleton h-[300px] lg:col-span-4" />
      <div className="skeleton h-[240px] lg:col-span-5" />
      <div className="skeleton h-[240px] lg:col-span-3" />
      <div className="skeleton h-[240px] lg:col-span-4" />
    </div>
  );
}
