import { AnimatePresence, motion } from 'motion/react';
import { Pause, Play, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { addDays, BREATHING_PATTERNS, formatDay, MOOD_INFO, todayISO, type BreathingPattern, type MoodEntry } from '@fettle/shared';
import { PageHeader, Stat } from '../components/Bits';
import { Card, EmptyState } from '../components/Card';
import { Chart, dayAxes, tooltipBase, type ChartTheme } from '../components/charts/Chart';
import { Button } from '../components/ui/Button';
import { Segmented } from '../components/ui/Segmented';
import { useUi } from '../components/UiProvider';
import { api } from '../lib/api';
import { celebrate } from '../lib/celebrate';
import { useDaily, useHealthMutation, useMindful, useMoods } from '../lib/queries';
import { cn, timeAgo } from '../lib/utils';

export function MindPage() {
  const { open } = useUi();
  const { data: moods } = useMoods(60);
  const { data: mindful } = useMindful(30);
  const totalMindful = Math.round((mindful?.reduce((a, s) => a + s.durationSec, 0) ?? 0) / 60);
  const recent = moods?.filter((m) => m.loggedOn > addDays(todayISO(), -7)) ?? [];
  const avg = recent.length ? recent.reduce((a, m) => a + m.mood, 0) / recent.length : null;

  return (
    <div>
      <PageHeader
        title="Mind"
        emoji="🧘"
        subtitle="Notice how you feel, and give yourself a minute to breathe."
        actions={
          <Button variant="primary" onClick={() => open({ kind: 'mood' })}>
            <Plus className="size-4" /> Check in
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-12">
        <Breathing />
        <div className="grid grid-cols-2 gap-4 lg:col-span-5 lg:grid-cols-2">
          <Stat label="Mood this week" value={avg ? MOOD_INFO[Math.round(avg) - 1]!.emoji : '—'} sub={avg ? `${avg.toFixed(1)} / 5 average` : 'Check in to see it'} />
          <Stat label="Check-ins (60 days)" value={moods?.length ?? 0} />
          <Stat label="Mindful minutes" value={totalMindful} sub="last 30 days" color="var(--c-mind)" />
          <Stat label="Sessions" value={mindful?.length ?? 0} sub="last 30 days" />
          <TagInsights moods={moods ?? []} />
        </div>
        <MoodChart />
        <Journal moods={moods ?? []} />
      </div>
    </div>
  );
}

const PHASES = ['Breathe in', 'Hold', 'Breathe out', 'Hold'] as const;

function Breathing() {
  const [pattern, setPattern] = useState<BreathingPattern>('box');
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(0);
  const [left, setLeft] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [minutes, setMinutes] = useState(2);
  const started = useRef<number>(0);
  const log = useHealthMutation((durationSec: number) => api.addMindful({ loggedOn: todayISO(), pattern, durationSec }), {
    success: (_, sec) => `${Math.round(sec / 60) || 1} mindful minute${sec >= 90 ? 's' : ''} logged 🪷`,
  });

  const phases = BREATHING_PATTERNS[pattern].phases;

  useEffect(() => {
    if (!running) return;
    let current = phase;
    let remaining = phases[current]!;
    setLeft(remaining);
    const tick = setInterval(() => {
      const total = Math.round((Date.now() - started.current) / 1000);
      setElapsed(total);
      if (total >= minutes * 60) {
        clearInterval(tick);
        setRunning(false);
        celebrate();
        log.mutate(total);
        return;
      }
      remaining--;
      if (remaining <= 0) {
        // Skip zero-length phases (e.g. patterns without a hold).
        do current = (current + 1) % 4;
        while (phases[current] === 0);
        remaining = phases[current]!;
        setPhase(current);
      }
      setLeft(remaining);
    }, 1000);
    return () => clearInterval(tick);
  }, [running, pattern, minutes]);

  const start = () => {
    started.current = Date.now();
    setElapsed(0);
    setPhase(0);
    setRunning(true);
  };
  const stop = () => {
    setRunning(false);
    if (elapsed >= 30) log.mutate(elapsed);
  };

  const expanded = running && (phase === 0 || phase === 1);
  const duration = running ? phases[phase]! : 1;

  return (
    <Card className="lg:col-span-7" title="Breathe" subtitle={BREATHING_PATTERNS[pattern].hint} bodyClassName="flex flex-col items-center gap-5">
      <div className="flex flex-wrap justify-center gap-2">
        <Segmented
          size="sm"
          value={pattern}
          onChange={(p) => !running && setPattern(p)}
          options={(Object.keys(BREATHING_PATTERNS) as BreathingPattern[]).map((p) => ({ value: p, label: BREATHING_PATTERNS[p].label }))}
        />
        <Segmented size="sm" value={String(minutes)} onChange={(m) => !running && setMinutes(Number(m))} options={['1', '2', '5'].map((m) => ({ value: m, label: `${m} min` }))} />
      </div>

      <div className="relative flex size-[260px] items-center justify-center">
        {running && <div className="absolute size-40 rounded-full border-2 border-[var(--c-mind)] animate-pulse-ring" />}
        <motion.div
          className="absolute rounded-full"
          style={{ background: 'radial-gradient(circle at 35% 30%, color-mix(in oklab, var(--c-mind) 70%, white), var(--c-sleep) 55%, var(--c-water))' }}
          animate={{ width: expanded ? 240 : 120, height: expanded ? 240 : 120, opacity: running ? 0.95 : 0.6, filter: `blur(${expanded ? 0 : 1}px)` }}
          transition={{ duration: running ? duration : 0.6, ease: 'easeInOut' }}
        />
        <motion.div className="absolute size-[250px] rounded-full border border-line" animate={{ rotate: running ? 360 : 0 }} transition={{ repeat: Infinity, duration: 20, ease: 'linear' }}>
          <span className="absolute left-1/2 top-0 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--c-mind)]" />
        </motion.div>
        <div className="relative text-center text-white drop-shadow">
          <AnimatePresence mode="wait">
            <motion.div key={running ? phase : 'idle'} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="display text-lg font-semibold">
              {running ? PHASES[phase] : 'Ready'}
            </motion.div>
          </AnimatePresence>
          {running && <div className="num text-3xl font-semibold">{left}</div>}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button variant={running ? 'secondary' : 'primary'} size="lg" onClick={running ? stop : start}>
          {running ? <Pause className="size-4" /> : <Play className="size-4" />}
          {running ? 'Finish' : 'Start'}
        </Button>
        {running && (
          <span className="num text-sm text-ink-3">
            {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')} / {minutes}:00
          </span>
        )}
      </div>
    </Card>
  );
}

function TagInsights({ moods }: { moods: MoodEntry[] }) {
  const byTag = new Map<string, number[]>();
  for (const m of moods) for (const t of m.tags) byTag.set(t, [...(byTag.get(t) ?? []), m.mood]);
  const rows = [...byTag.entries()]
    .filter(([, v]) => v.length >= 2)
    .map(([tag, v]) => ({ tag, avg: v.reduce((a, b) => a + b, 0) / v.length, n: v.length }))
    .sort((a, b) => b.avg - a.avg);
  return (
    <div className="col-span-2 rounded-2xl border border-line bg-surface-2/60 p-3.5">
      <div className="mb-2 text-xs font-medium text-ink-3">What lifts you (avg mood by tag)</div>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-3">Tag a few check-ins to see patterns.</p>
      ) : (
        <div className="space-y-1.5">
          {rows.slice(0, 5).map((r) => (
            <div key={r.tag} className="flex items-center gap-2 text-sm">
              <span className="w-24 capitalize text-ink-2">{r.tag}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--track)]">
                <motion.div className="h-full rounded-full" style={{ background: MOOD_INFO[Math.round(r.avg) - 1]!.color }} initial={{ width: 0 }} animate={{ width: `${(r.avg / 5) * 100}%` }} />
              </div>
              <span>{MOOD_INFO[Math.round(r.avg) - 1]!.emoji}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MoodChart() {
  const { data } = useDaily(30);
  const option = (t: ChartTheme) => ({
    tooltip: { ...tooltipBase(t), trigger: 'axis' },
    legend: { bottom: 0, icon: 'circle', itemWidth: 8, textStyle: { color: t.text2, fontSize: 11 } },
    grid: { left: 8, right: 12, top: 12, bottom: 30, containLabel: true },
    ...dayAxes(t, data?.map((d) => d.day) ?? [], { min: 1, max: 5 }),
    series: [
      { name: 'Mood', key: 'mood', color: t.c('mind') },
      { name: 'Energy', key: 'energy', color: t.c('active') },
      { name: 'Stress', key: 'stress', color: t.c('fat') },
    ].map((s) => ({
      type: 'line',
      name: s.name,
      smooth: 0.35,
      connectNulls: true,
      symbolSize: 6,
      lineStyle: { width: s.key === 'mood' ? 3 : 2, color: s.color },
      itemStyle: { color: s.color },
      data: data?.map((d) => d[s.key as 'mood' | 'energy' | 'stress']),
    })),
  });
  return (
    <Card className="lg:col-span-7" title="Mood, energy & stress" subtitle="Last 30 days, 1 to 5" delay={0.06}>
      {data ? <Chart option={option} height={250} ariaLabel="Daily mood, energy and stress for 30 days" /> : <div className="skeleton h-[250px]" />}
    </Card>
  );
}

function Journal({ moods }: { moods: MoodEntry[] }) {
  const remove = useHealthMutation((id: string) => api.deleteMood(id), { success: 'Check-in removed' });
  const entries = [...moods].reverse().slice(0, 20);
  return (
    <Card className="lg:col-span-5" title="Journal" delay={0.08}>
      {entries.length === 0 ? (
        <EmptyState icon="📓" title="No check-ins yet">
          A 10-second check-in each evening builds a picture of what helps you.
        </EmptyState>
      ) : (
        <ul className="max-h-[300px] space-y-2 overflow-y-auto">
          {entries.map((m) => {
            const info = MOOD_INFO[m.mood - 1]!;
            return (
              <li key={m.id} className="group rounded-2xl border border-line p-3" style={{ background: `color-mix(in oklab, ${info.color} 7%, transparent)` }}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{info.emoji}</span>
                  <span className="text-sm font-medium">{info.label}</span>
                  <span className="text-xs text-ink-3">· {m.loggedOn === todayISO() ? timeAgo(m.loggedAt) : formatDay(m.loggedOn)}</span>
                  <button onClick={() => remove.mutate(m.id)} className="ml-auto rounded-lg p-1 text-ink-3 opacity-0 hover:text-bad group-hover:opacity-100" aria-label="Delete check-in">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                {m.note && <p className="mt-1.5 text-sm text-ink-2">{m.note}</p>}
                {m.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {m.tags.map((t) => (
                      <span key={t} className={cn('rounded-full bg-surface-2 px-2 py-0.5 text-[11px] capitalize text-ink-3')}>
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
