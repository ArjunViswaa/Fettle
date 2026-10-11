import { motion } from 'motion/react';
import { Square, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { FAST_PRESETS, FASTING_STAGES, minutesToHM, type Fast } from '@fettle/shared';
import { PageHeader, Stat } from '../components/Bits';
import { Card, EmptyState } from '../components/Card';
import { Rings } from '../components/Rings';
import { Button } from '../components/ui/Button';
import { api } from '../lib/api';
import { celebrate } from '../lib/celebrate';
import { useFasts, useHealthMutation } from '../lib/queries';
import { cn, fromLocalInput, toLocalInput } from '../lib/utils';

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

const hoursBetween = (a: string, b: number | string) => (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000;

export function FastingPage() {
  const { data } = useFasts();
  const active = data?.active ?? null;
  const history = data?.history ?? [];
  const completed = history.filter((f) => hoursBetween(f.startedAt, f.endedAt!) >= f.targetHours);
  const longest = Math.max(0, ...history.map((f) => hoursBetween(f.startedAt, f.endedAt!)));

  return (
    <div>
      <PageHeader title="Fasting" emoji="⏳" subtitle="Intermittent fasting timer. Listen to your body; skip it if you are pregnant, diabetic or have a history of disordered eating." />
      <div className="grid gap-4 lg:grid-cols-12">
        {active ? <ActiveFast fast={active} /> : <StartFast />}
        <div className="grid grid-cols-2 gap-4 lg:col-span-4 lg:grid-cols-1">
          <Stat label="Fasts completed" value={completed.length} sub={`of ${history.length} started`} color="var(--c-energy)" />
          <Stat label="Longest fast" value={longest ? minutesToHM(longest * 60) : '—'} />
        </div>
        <History fasts={history} />
      </div>
    </div>
  );
}

function StartFast() {
  const [preset, setPreset] = useState<number>(16);
  const [startAt, setStartAt] = useState(toLocalInput(new Date()));
  const start = useHealthMutation(() => api.startFast({ targetHours: preset, startedAt: fromLocalInput(startAt) }), { success: 'Fast started. You’ve got this 💪' });
  return (
    <Card className="lg:col-span-8" title="Start a fast" bodyClassName="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {FAST_PRESETS.map((p, i) => (
          <motion.button
            key={p.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setPreset(p.hours)}
            className={cn(
              'rounded-2xl border p-3 text-center transition-colors',
              preset === p.hours ? 'border-[color-mix(in_oklab,var(--c-energy)_60%,transparent)] bg-[color-mix(in_oklab,var(--c-energy)_12%,transparent)]' : 'border-line hover:border-line-strong',
            )}
          >
            <div className="display num text-xl font-semibold">{p.id}</div>
            <div className="text-xs font-medium">{p.label}</div>
            <div className="text-[11px] text-ink-3">{p.hint}</div>
          </motion.button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label>
          <span className="label">Started</span>
          <input type="datetime-local" className="input" value={startAt} max={toLocalInput(new Date())} onChange={(e) => setStartAt(e.target.value)} />
        </label>
        <Button variant="primary" size="lg" onClick={() => start.mutate()} loading={start.isPending}>
          Start {preset}h fast
        </Button>
      </div>
    </Card>
  );
}

function ActiveFast({ fast }: { fast: Fast }) {
  const now = useNow();
  const elapsedH = hoursBetween(fast.startedAt, now);
  const done = elapsedH >= fast.targetHours;
  const end = useHealthMutation(() => api.endFast(fast.id), {
    success: () => (done ? 'Fast complete! 🎉' : 'Fast ended'),
    onSuccess: () => done && celebrate(),
  });
  const stage = [...FASTING_STAGES].reverse().find((s) => elapsedH >= s.fromHour)!;
  const remaining = Math.max(0, fast.targetHours - elapsedH);
  const fmtClock = (h: number) => {
    const s = Math.floor(h * 3600);
    return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };
  const endsAt = new Date(new Date(fast.startedAt).getTime() + fast.targetHours * 3_600_000);

  return (
    <Card className="lg:col-span-8" bodyClassName="flex flex-col items-center gap-8 md:flex-row">
      <Rings rings={[{ key: 'fast', value: elapsedH, target: fast.targetHours, color: 'var(--c-energy)' }]} size={250} stroke={20}>
        <span className="text-2xl">{stage.emoji}</span>
        <span className="display num text-3xl font-semibold">{fmtClock(elapsedH)}</span>
        <span className="text-xs text-ink-3">{done ? 'Goal reached!' : `${fmtClock(remaining)} to go`}</span>
      </Rings>
      <div className="w-full flex-1">
        <div className="text-sm text-ink-3">
          {fast.targetHours}h fast · ends {endsAt.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
        </div>
        <ol className="mt-4 space-y-2">
          {FASTING_STAGES.map((s) => {
            const reached = elapsedH >= s.fromHour;
            const current = s === stage;
            return (
              <motion.li key={s.name} animate={{ opacity: reached ? 1 : 0.45 }} className={cn('flex items-start gap-3 rounded-2xl p-2', current && 'bg-surface-2')}>
                <span className="text-xl">{s.emoji}</span>
                <span className="flex-1">
                  <span className="block text-sm font-medium">
                    {s.name} <span className="text-xs font-normal text-ink-3">· {s.fromHour}h+</span>
                  </span>
                  <span className="block text-xs text-ink-3">{s.hint}</span>
                </span>
                {current && <span className="mt-1 size-2 animate-pulse rounded-full bg-[var(--c-energy)]" />}
              </motion.li>
            );
          })}
        </ol>
        <Button variant={done ? 'primary' : 'secondary'} size="lg" className="mt-5 w-full justify-center" onClick={() => end.mutate()} loading={end.isPending}>
          <Square className="size-4" /> {done ? 'Finish & eat 🍽️' : 'End fast early'}
        </Button>
      </div>
    </Card>
  );
}

function History({ fasts }: { fasts: Fast[] }) {
  const remove = useHealthMutation((id: string) => api.deleteFast(id), { success: 'Removed' });
  return (
    <Card className="lg:col-span-12" title="History" delay={0.05}>
      {fasts.length === 0 ? (
        <EmptyState icon="⏳" title="No fasts yet" />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {fasts.map((f) => {
            const h = hoursBetween(f.startedAt, f.endedAt!);
            const ok = h >= f.targetHours;
            return (
              <div key={f.id} className="group flex items-center gap-3 rounded-2xl border border-line p-3">
                <span className="text-xl">{ok ? '✅' : '⏹️'}</span>
                <span className="flex-1 text-sm">
                  <span className="block font-medium">{minutesToHM(h * 60)}</span>
                  <span className="block text-xs text-ink-3">
                    {new Date(f.startedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · goal {f.targetHours}h
                  </span>
                </span>
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--track)]">
                  <div className="h-full rounded-full bg-[var(--c-energy)]" style={{ width: `${Math.min(1, h / f.targetHours) * 100}%` }} />
                </div>
                <button onClick={() => remove.mutate(f.id)} className="rounded-lg p-1 text-ink-3 opacity-0 hover:text-bad group-hover:opacity-100" aria-label="Delete fast">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
