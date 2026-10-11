import { AnimatePresence, motion } from 'motion/react';
import { Archive, Check, Plus } from 'lucide-react';
import { useState } from 'react';
import { addDays, eachDay, HABIT_COLORS, parseISODate, todayISO, type Habit } from '@fettle/shared';
import { PageHeader, Stepper } from '../components/Bits';
import { Card, EmptyState } from '../components/Card';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Field, Input } from '../components/ui/Field';
import { api } from '../lib/api';
import { useHabits, useHealthMutation } from '../lib/queries';
import { cn } from '../lib/utils';

const DAYS = 14;
const EMOJIS = ['✨', '💊', '📖', '🧘', '🙆', '🥗', '🚭', '📵', '🦷', '🌞', '🚶', '💪', '🎸', '✍️', '🧴', '🍵'];

export function HabitsPage() {
  const { data: habits } = useHabits(DAYS);
  const [editing, setEditing] = useState<Habit | 'new' | null>(null);
  const today = todayISO();
  const days = eachDay(addDays(today, -(DAYS - 1)), today);
  const doneToday = habits?.filter((h) => (h.checkins[today] ?? 0) >= h.targetPerDay).length ?? 0;

  return (
    <div>
      <PageHeader
        title="Habits"
        emoji="🌱"
        subtitle={habits?.length ? `${doneToday} of ${habits.length} done today. Small things, every day.` : 'Small things, every day.'}
        actions={
          <Button variant="primary" onClick={() => setEditing('new')}>
            <Plus className="size-4" /> New habit
          </Button>
        }
      />
      {habits?.length === 0 ? (
        <Card>
          <EmptyState icon="🌱" title="No habits yet">
            Start with one tiny habit you can't fail at.
          </EmptyState>
        </Card>
      ) : (
        <Card bodyClassName="overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-y-1.5">
            <thead>
              <tr className="text-[11px] text-ink-3">
                <th className="text-left font-medium">Habit</th>
                {days.map((d) => (
                  <th key={d} className={cn('w-8 font-medium', d === today && 'text-ink')}>
                    <div>{parseISODate(d).toLocaleDateString(undefined, { weekday: 'narrow' })}</div>
                    <div className="num">{Number(d.slice(8))}</div>
                  </th>
                ))}
                <th className="w-20 font-medium">Streak</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {habits?.map((h, i) => <HabitRow key={h.id} habit={h} days={days} index={i} onEdit={() => setEditing(h)} />)}
              </AnimatePresence>
            </tbody>
          </table>
        </Card>
      )}
      <HabitDialog target={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function HabitRow({ habit, days, index, onEdit }: { habit: Habit; days: string[]; index: number; onEdit: () => void }) {
  const today = todayISO();
  const checkin = useHealthMutation(({ day, count }: { day: string; count: number }) => api.checkin(habit.id, day, count));
  return (
    <motion.tr layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: index * 0.04 }}>
      <td className="pr-3">
        <button onClick={onEdit} className="flex items-center gap-2.5 rounded-xl py-1 text-left hover:opacity-80">
          <span className="flex size-9 items-center justify-center rounded-xl text-lg" style={{ background: `color-mix(in oklab, ${habit.color} 18%, transparent)` }}>
            {habit.emoji}
          </span>
          <span>
            <span className="block text-sm font-medium">{habit.name}</span>
            {habit.targetPerDay > 1 && <span className="block text-[11px] text-ink-3">{habit.targetPerDay}× a day</span>}
          </span>
        </button>
      </td>
      {days.map((d) => {
        const count = habit.checkins[d] ?? 0;
        const done = count >= habit.targetPerDay;
        const partial = count > 0 && !done;
        return (
          <td key={d} className="text-center">
            <motion.button
              whileTap={{ scale: 0.8 }}
              onClick={() => checkin.mutate({ day: d, count: done ? 0 : count + 1 })}
              aria-label={`${habit.name} on ${d}: ${done ? 'done' : 'not done'}`}
              className={cn('mx-auto flex size-7 items-center justify-center rounded-lg border transition-colors', d === today ? 'border-line-strong' : 'border-line')}
              style={{
                background: done ? habit.color : partial ? `color-mix(in oklab, ${habit.color} 35%, transparent)` : undefined,
                borderColor: done ? habit.color : undefined,
              }}
            >
              <AnimatePresence>
                {done && (
                  <motion.span initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}>
                    <Check className="size-4 text-white" strokeWidth={3} />
                  </motion.span>
                )}
              </AnimatePresence>
              {partial && <span className="num text-[10px] font-semibold">{count}</span>}
            </motion.button>
          </td>
        );
      })}
      <td className="text-center">
        <div className="num text-sm font-semibold">{habit.currentStreak > 0 ? `🔥 ${habit.currentStreak}` : '—'}</div>
        <div className="text-[10px] text-ink-3">best {habit.longestStreak}</div>
      </td>
    </motion.tr>
  );
}

function HabitDialog({ target, onClose }: { target: Habit | 'new' | null; onClose: () => void }) {
  const editing = target && target !== 'new' ? target : null;
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('✨');
  const [color, setColor] = useState<string>(HABIT_COLORS[0]);
  const [perDay, setPerDay] = useState(1);
  const [lastTarget, setLastTarget] = useState<typeof target>(null);

  // Reset the form whenever a different habit (or "new") is opened.
  if (target !== lastTarget) {
    setLastTarget(target);
    if (target) {
      setName(editing?.name ?? '');
      setEmoji(editing?.emoji ?? '✨');
      setColor(editing?.color ?? HABIT_COLORS[Math.floor(Math.random() * HABIT_COLORS.length)]!);
      setPerDay(editing?.targetPerDay ?? 1);
    }
  }

  const save = useHealthMutation(
    () => {
      const input = { name, emoji, color, targetPerDay: perDay };
      return editing ? api.updateHabit(editing.id, input) : api.addHabit(input);
    },
    { success: editing ? 'Habit updated' : 'Habit added. You’ve got this! 🌱', onSuccess: onClose },
  );
  const archive = useHealthMutation(() => api.updateHabit(editing!.id, { archived: true }), { success: 'Habit archived', onSuccess: onClose });

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()} title={editing ? 'Edit habit' : 'New habit'} icon={emoji}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        className="space-y-4"
      >
        <Field label="Habit">
          <Input required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Read 10 pages" maxLength={60} />
        </Field>
        <div>
          <div className="label">Icon</div>
          <div className="flex flex-wrap gap-1.5">
            {EMOJIS.map((e) => (
              <button type="button" key={e} onClick={() => setEmoji(e)} className={cn('flex size-9 items-center justify-center rounded-xl text-lg transition', emoji === e ? 'scale-110 bg-surface-3 ring-1 ring-line-strong' : 'hover:bg-surface-2')}>
                {e}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="label">Colour</div>
          <div className="flex gap-2">
            {HABIT_COLORS.map((c) => (
              <button type="button" key={c} onClick={() => setColor(c)} aria-label={c} className={cn('size-8 rounded-full transition', color === c && 'ring-2 ring-offset-2 ring-offset-[var(--surface)]')} style={{ background: c, ['--tw-ring-color' as string]: c }} />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="label mb-0">Times per day</span>
          <Stepper value={perDay} onChange={setPerDay} min={1} max={20} />
        </div>
        <div className="flex gap-2 pt-2">
          {editing && (
            <Button type="button" variant="ghost" onClick={() => archive.mutate()} loading={archive.isPending}>
              <Archive className="size-4" /> Archive
            </Button>
          )}
          <Button type="submit" variant="primary" size="lg" className="flex-1 justify-center" loading={save.isPending}>
            {editing ? 'Save' : 'Add habit'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
