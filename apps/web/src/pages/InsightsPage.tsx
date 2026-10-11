import { motion } from 'motion/react';
import { ArrowDownRight, ArrowUpRight, Lock, Minus } from 'lucide-react';
import { useState } from 'react';
import { correlation, formatWater, kgToDisplay, minutesToHM, weightUnit, type DailyPoint, type Profile } from '@fettle/shared';
import { PageHeader } from '../components/Bits';
import { Card } from '../components/Card';
import { Chart, dayAxes, tooltipBase, type ChartTheme } from '../components/charts/Chart';
import { Segmented } from '../components/ui/Segmented';
import { useAchievements, useDaily, useProfile, useUnits } from '../lib/queries';
import { cn, fmt } from '../lib/utils';

type Period = '7' | '30' | '90';

const avg = (points: DailyPoint[], key: keyof DailyPoint) => {
  const vals = points.map((p) => p[key]).filter((v): v is number => typeof v === 'number');
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
};

export function InsightsPage() {
  const [period, setPeriod] = useState<Period>('7');
  const days = Number(period);
  const { data: profile } = useProfile();
  // Fetch two periods so each figure can be compared with the one before.
  const { data } = useDaily(days * 2);
  if (!profile) return null;
  const current = data?.slice(days) ?? [];
  const previous = data?.slice(0, days) ?? [];

  return (
    <div>
      <PageHeader
        title="Insights"
        emoji="📊"
        subtitle="Patterns across everything you log."
        actions={
          <Segmented
            value={period}
            onChange={setPeriod}
            options={[
              { value: '7', label: 'Week' },
              { value: '30', label: 'Month' },
              { value: '90', label: 'Quarter' },
            ]}
          />
        }
      />
      <div className="grid gap-4 lg:grid-cols-12">
        <Report current={current} previous={previous} profile={profile} />
        <Discoveries points={data ?? []} profile={profile} />
        <Card className="lg:col-span-7" title="Energy balance" subtitle="Calories eaten vs burned through activity" delay={0.05}>
          <BalanceChart points={current} profile={profile} />
        </Card>
        <Card className="lg:col-span-5" title="Sleep vs next-day mood" subtitle="Each dot is a day" delay={0.08}>
          <SleepMoodChart points={data ?? []} />
        </Card>
        <Badges />
      </div>
    </div>
  );
}

function Report({ current, previous, profile }: { current: DailyPoint[]; previous: DailyPoint[]; profile: Profile }) {
  const units = useUnits();
  const weights = current.filter((p) => p.weightKg !== null);
  const weightChange = weights.length >= 2 ? weights.at(-1)!.weightKg! - weights[0]!.weightKg! : null;

  const rows: Array<{ label: string; emoji: string; key: keyof DailyPoint; target?: number; format: (v: number) => string; better: 'up' | 'down' | 'target' }> = [
    { label: 'Calories', emoji: '🍽️', key: 'calories', target: profile.calorieTarget, format: (v) => `${fmt(v)} kcal`, better: 'target' },
    { label: 'Protein', emoji: '🥩', key: 'proteinG', target: profile.proteinTargetG, format: (v) => `${fmt(v)} g`, better: 'up' },
    { label: 'Steps', emoji: '👟', key: 'steps', target: profile.stepTarget, format: (v) => fmt(v), better: 'up' },
    { label: 'Active', emoji: '⚡', key: 'activeMinutes', target: profile.activeMinutesTarget, format: (v) => `${fmt(v)} min`, better: 'up' },
    { label: 'Water', emoji: '💧', key: 'waterMl', target: profile.waterTargetMl, format: (v) => formatWater(v, units), better: 'up' },
    { label: 'Sleep', emoji: '🌙', key: 'sleepMinutes', target: profile.sleepTargetMinutes, format: (v) => minutesToHM(v), better: 'up' },
    { label: 'Mood', emoji: '🙂', key: 'mood', format: (v) => `${v.toFixed(1)} / 5`, better: 'up' },
    { label: 'Stress', emoji: '😬', key: 'stress', format: (v) => `${v.toFixed(1)} / 5`, better: 'down' },
  ];

  return (
    <Card className="lg:col-span-7" title="Daily averages" subtitle="Compared with the period before">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {rows.map((r, i) => {
          const now = avg(current, r.key);
          const before = avg(previous, r.key);
          const change = now !== null && before ? (now - before) / before : null;
          let good: boolean | null = null;
          if (change !== null && Math.abs(change) > 0.02) {
            if (r.better === 'target' && r.target) good = Math.abs(now! - r.target) < Math.abs(before! - r.target);
            else good = r.better === 'up' ? change > 0 : change < 0;
          }
          const Icon = change === null || Math.abs(change) <= 0.02 ? Minus : change > 0 ? ArrowUpRight : ArrowDownRight;
          return (
            <motion.div key={r.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="rounded-2xl border border-line bg-surface-2/60 p-3">
              <div className="flex items-center justify-between text-xs text-ink-3">
                {r.label} <span>{r.emoji}</span>
              </div>
              <div className="num mt-1 font-semibold">{now === null ? '—' : r.format(now)}</div>
              <div className="mt-0.5 flex items-center gap-1 text-[11px]" style={{ color: good === null ? 'var(--text-3)' : good ? 'var(--good)' : 'var(--warn)' }}>
                <Icon className="size-3" />
                {change === null ? 'no comparison' : `${Math.abs(Math.round(change * 100))}%`}
              </div>
            </motion.div>
          );
        })}
      </div>
      {weightChange !== null && (
        <p className="mt-3 text-sm text-ink-2">
          ⚖️ Weight changed by{' '}
          <b className="num">
            {weightChange > 0 ? '+' : ''}
            {(kgToDisplay(weightChange, units)).toFixed(1)} {weightUnit(units)}
          </b>{' '}
          over this period.
        </p>
      )}
    </Card>
  );
}

/** Plain-language findings from the user's own data. Only says something when there's enough to say it. */
function Discoveries({ points, profile }: { points: DailyPoint[]; profile: Profile }) {
  const found: Array<{ emoji: string; text: string }> = [];
  const byDay = new Map(points.map((p) => [p.day, p]));

  const sleepMood: Array<[number, number]> = [];
  const stepsMood: Array<[number, number]> = [];
  const sleepEnergy: Array<[number, number]> = [];
  for (const p of points) {
    if (p.sleepMinutes !== null && p.mood !== null) sleepMood.push([p.sleepMinutes, p.mood]);
    if (p.sleepMinutes !== null && p.energy !== null) sleepEnergy.push([p.sleepMinutes, p.energy]);
    if (p.steps !== null && p.mood !== null) stepsMood.push([p.steps, p.mood]);
  }
  const describe = (r: number | null, a: string, b: string, emoji: string) => {
    if (r === null || Math.abs(r) < 0.3) return;
    found.push({ emoji, text: `${r > 0 ? 'More' : 'Less'} ${a} tends to go with a better ${b} for you (${Math.abs(r) >= 0.6 ? 'strong' : 'moderate'} link).` });
  };
  describe(correlation(sleepMood), 'sleep', 'mood', '🌙');
  describe(correlation(sleepEnergy), 'sleep', 'energy level', '⚡');
  describe(correlation(stepsMood), 'walking', 'mood', '👟');

  // Do short nights lead to eating more the next day?
  const shortNights = points.filter((p) => p.sleepMinutes !== null && p.sleepMinutes < 390);
  const longNights = points.filter((p) => p.sleepMinutes !== null && p.sleepMinutes >= 420);
  const eatenAfter = (nights: DailyPoint[]) => nights.map((n) => byDay.get(n.day)?.calories).filter((c): c is number => !!c);
  const shortEat = eatenAfter(shortNights);
  const longEat = eatenAfter(longNights);
  if (shortEat.length >= 3 && longEat.length >= 3) {
    const diff = shortEat.reduce((a, b) => a + b, 0) / shortEat.length - longEat.reduce((a, b) => a + b, 0) / longEat.length;
    if (diff > 150) found.push({ emoji: '🍪', text: `After nights under 6½ hours you eat about ${fmt(diff)} kcal more. Sleep might be your best appetite control.` });
  }

  const recent = points.slice(-7);
  const proteinDays = recent.filter((p) => (p.proteinG ?? 0) >= profile.proteinTargetG).length;
  if (recent.some((p) => p.calories) && proteinDays <= 2) found.push({ emoji: '🥚', text: `You hit your protein goal on ${proteinDays} of the last 7 days. Eggs, dal, paneer or curd at breakfast is an easy win.` });
  const waterDays = recent.filter((p) => (p.waterMl ?? 0) >= profile.waterTargetMl).length;
  if (waterDays >= 5) found.push({ emoji: '💧', text: `Hydration on point: water goal met ${waterDays} of the last 7 days.` });
  const stepWeekend = recent.filter((p) => [0, 6].includes(new Date(`${p.day}T12:00`).getDay()));
  const stepWeekday = recent.filter((p) => ![0, 6].includes(new Date(`${p.day}T12:00`).getDay()));
  const ws = avg(stepWeekend, 'steps');
  const wd = avg(stepWeekday, 'steps');
  if (ws && wd && wd > ws * 1.3) found.push({ emoji: '🛋️', text: `Weekends are your quiet days: ${fmt(ws)} steps vs ${fmt(wd)} on weekdays. A weekend walk would even it out.` });

  return (
    <Card className="lg:col-span-5" title="Discoveries" subtitle="What your data is telling you" delay={0.04}>
      {found.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-3">Keep logging sleep, mood, food and steps for a couple of weeks and patterns will show up here.</p>
      ) : (
        <ul className="space-y-2">
          {found.slice(0, 5).map((f, i) => (
            <motion.li key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.07 }} className="flex gap-3 rounded-2xl bg-surface-2/70 p-3 text-sm">
              <span className="text-xl">{f.emoji}</span>
              <span className="text-ink-2">{f.text}</span>
            </motion.li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function BalanceChart({ points, profile }: { points: DailyPoint[]; profile: Profile }) {
  const option = (t: ChartTheme) => ({
    tooltip: { ...tooltipBase(t), trigger: 'axis', valueFormatter: (v: number) => `${fmt(v ?? 0)} kcal` },
    legend: { bottom: 0, icon: 'circle', itemWidth: 8, textStyle: { color: t.text2, fontSize: 11 } },
    grid: { left: 8, right: 12, top: 12, bottom: 30, containLabel: true },
    ...dayAxes(t, points.map((p) => p.day)),
    series: [
      { type: 'bar', name: 'Eaten', barGap: '10%', data: points.map((p) => Math.round(p.calories ?? 0)), itemStyle: { color: t.c('energy'), borderRadius: [5, 5, 0, 0] } },
      { type: 'bar', name: 'Burned (activity)', data: points.map((p) => Math.round(p.burned ?? 0)), itemStyle: { color: t.c('move'), borderRadius: [5, 5, 0, 0] } },
      {
        type: 'line',
        name: 'Goal',
        symbol: 'none',
        lineStyle: { type: 'dashed', color: t.text3, width: 1.5 },
        data: points.map(() => profile.calorieTarget),
      },
    ],
  });
  return <Chart option={option} height={270} ariaLabel="Calories eaten and burned per day" />;
}

function SleepMoodChart({ points }: { points: DailyPoint[] }) {
  const pairs = points.filter((p) => p.sleepMinutes !== null && p.mood !== null).map((p) => [Math.round((p.sleepMinutes! / 60) * 10) / 10, p.mood!]);
  if (pairs.length < 3) return <p className="py-16 text-center text-sm text-ink-3">Log sleep and mood on the same days to see this.</p>;
  const option = (t: ChartTheme) => ({
    tooltip: { ...tooltipBase(t), formatter: (p: { value: number[] }) => `${p.value[0]} h sleep → mood ${p.value[1]}` },
    grid: { left: 8, right: 16, top: 12, bottom: 24, containLabel: true },
    xAxis: { type: 'value', name: 'hours', nameLocation: 'middle', nameGap: 24, nameTextStyle: { color: t.text3, fontSize: 11 }, scale: true, axisLabel: { color: t.text3, fontSize: 11 }, splitLine: { lineStyle: { color: t.grid, type: 'dashed' } } },
    yAxis: { type: 'value', min: 1, max: 5, interval: 1, axisLabel: { color: t.text3, formatter: (v: number) => ['', '😫', '😕', '😐', '🙂', '😄'][v] }, splitLine: { lineStyle: { color: t.grid, type: 'dashed' } } },
    series: [{ type: 'scatter', symbolSize: 14, data: pairs, itemStyle: { color: t.c('sleep'), opacity: 0.75 } }],
  });
  return <Chart option={option} height={270} ariaLabel="Scatter of hours slept against mood" />;
}

function Badges() {
  const { data } = useAchievements();
  const unlocked = data?.all.filter((a) => a.unlockedAt).length ?? 0;
  const tierRing = { bronze: '#d9915a', silver: '#c0c7d1', gold: '#f5c84c' };
  return (
    <Card className="lg:col-span-12" title="Badges" subtitle={data ? `${unlocked} of ${data.all.length} earned` : undefined} delay={0.1}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {data?.all.map((a, i) => {
          const got = !!a.unlockedAt;
          return (
            <motion.div
              key={a.code}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.025, type: 'spring', stiffness: 300, damping: 20 }}
              whileHover={got ? { y: -4, rotate: [-1, 1, 0] } : undefined}
              className={cn('relative flex flex-col items-center rounded-2xl border border-line p-4 text-center', got ? 'bg-surface-2' : 'opacity-50')}
            >
              <div className="relative mb-2 flex size-16 items-center justify-center rounded-full text-3xl" style={{ boxShadow: got ? `0 0 0 3px ${tierRing[a.tier]}, 0 10px 30px -10px ${tierRing[a.tier]}` : `0 0 0 2px var(--border-strong)` }}>
                <span className={cn(!got && 'grayscale')}>{a.emoji}</span>
                {!got && <Lock className="absolute -bottom-1 -right-1 size-5 rounded-full bg-surface-3 p-1 text-ink-3" />}
              </div>
              <div className="text-sm font-semibold">{a.title}</div>
              <div className="mt-0.5 text-[11px] leading-tight text-ink-3">{a.hint}</div>
              {got && <div className="mt-1.5 text-[10px] text-ink-3">{new Date(a.unlockedAt!).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</div>}
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
}
