import { motion } from 'motion/react';
import { Check, Plus, SkipForward, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { formatDay, HABIT_COLORS, todayISO, type DoseSlot, type Medication } from '@fettle/shared';
import { DayNav, PageHeader } from '../components/Bits';
import { Card, EmptyState } from '../components/Card';
import { ProgressRing } from '../components/Rings';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Field, Input } from '../components/ui/Field';
import { api } from '../lib/api';
import { useDoses, useHealthMutation, useMedications } from '../lib/queries';
import { cn } from '../lib/utils';

export function MedsPage() {
  const [day, setDay] = useState(todayISO());
  const { data: doses } = useDoses(day);
  const { data: meds } = useMedications();
  const [editing, setEditing] = useState<Medication | 'new' | null>(null);
  const taken = doses?.filter((d) => d.status === 'taken').length ?? 0;
  const total = doses?.length ?? 0;
  const active = meds?.filter((m) => !m.archived) ?? [];

  return (
    <div>
      <PageHeader
        title="Medication"
        emoji="💊"
        subtitle="Medicines and supplements, with a daily checklist."
        actions={
          <>
            <DayNav day={day} onChange={setDay} />
            <Button variant="primary" onClick={() => setEditing('new')}>
              <Plus className="size-4" /> Add
            </Button>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7" title={day === todayISO() ? "Today's doses" : formatDay(day)}>
          {total === 0 ? (
            <EmptyState icon="💊" title="Nothing scheduled">
              Add a medicine or supplement with the times you take it.
            </EmptyState>
          ) : (
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <ProgressRing value={taken} target={total} color="var(--c-water)" size={130} stroke={13}>
                <span className="display num text-2xl font-semibold">
                  {taken}/{total}
                </span>
                <span className="text-xs text-ink-3">taken</span>
              </ProgressRing>
              <ol className="relative flex-1 space-y-2 border-l border-line pl-5">
                {doses!.map((d) => (
                  <DoseRow key={`${d.medicationId}-${d.time}`} dose={d} day={day} />
                ))}
              </ol>
            </div>
          )}
        </Card>
        <Card className="lg:col-span-5" title="Your list" delay={0.05}>
          {active.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-3">No medicines added.</p>
          ) : (
            <ul className="space-y-1">
              {active.map((m) => (
                <li key={m.id}>
                  <button onClick={() => setEditing(m)} className="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left hover:bg-surface-2">
                    <span className="flex size-10 items-center justify-center rounded-xl" style={{ background: `color-mix(in oklab, ${m.color} 18%, transparent)` }}>
                      💊
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {m.name} {m.dosage && <span className="text-ink-3">· {m.dosage}</span>}
                      </span>
                      <span className="block text-xs text-ink-3">
                        {m.times.join(', ')}
                        {m.endsOn ? ` · until ${formatDay(m.endsOn)}` : ''}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <MedicationDialog target={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function DoseRow({ dose, day }: { dose: DoseSlot; day: string }) {
  const set = useHealthMutation((status: DoseSlot['status']) => api.setDose(dose.medicationId, { day, time: dose.time, status }));
  const taken = dose.status === 'taken';
  const skipped = dose.status === 'skipped';
  return (
    <motion.li layout className="relative flex items-center gap-3 rounded-2xl border border-line p-3">
      <span className="absolute -left-[27px] top-1/2 size-3 -translate-y-1/2 rounded-full border-2 border-[var(--surface)]" style={{ background: taken ? 'var(--good)' : skipped ? 'var(--text-3)' : dose.color }} />
      <span className="num w-12 text-sm font-semibold">{dose.time}</span>
      <span className={cn('flex-1 text-sm', (taken || skipped) && 'text-ink-3 line-through')}>
        {dose.name} {dose.dosage && <span className="text-ink-3">· {dose.dosage}</span>}
        {taken && dose.takenAt && <span className="block text-[11px] no-underline">taken at {new Date(dose.takenAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>}
      </span>
      {dose.status === 'pending' ? (
        <>
          <button onClick={() => set.mutate('skipped')} className="rounded-lg p-2 text-ink-3 hover:bg-surface-2" title="Skip" aria-label="Skip dose">
            <SkipForward className="size-4" />
          </button>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => set.mutate('taken')} className="flex h-9 items-center gap-1.5 rounded-xl bg-[color-mix(in_oklab,var(--good)_18%,transparent)] px-3 text-sm font-semibold text-good">
            <Check className="size-4" /> Take
          </motion.button>
        </>
      ) : (
        <button onClick={() => set.mutate('pending')} className="rounded-lg p-2 text-ink-3 hover:bg-surface-2" title="Undo" aria-label="Undo">
          <X className="size-4" />
        </button>
      )}
    </motion.li>
  );
}

function MedicationDialog({ target, onClose }: { target: Medication | 'new' | null; onClose: () => void }) {
  const editing = target && target !== 'new' ? target : null;
  const [form, setForm] = useState({ name: '', dosage: '', instructions: '', startedOn: todayISO(), endsOn: '' });
  const [times, setTimes] = useState<string[]>(['08:00']);
  const [color, setColor] = useState<string>(HABIT_COLORS[3]);
  const [last, setLast] = useState<typeof target>(null);
  if (target !== last) {
    setLast(target);
    if (target) {
      setForm({ name: editing?.name ?? '', dosage: editing?.dosage ?? '', instructions: editing?.instructions ?? '', startedOn: editing?.startedOn ?? todayISO(), endsOn: editing?.endsOn ?? '' });
      setTimes(editing?.times ?? ['08:00']);
      setColor(editing?.color ?? HABIT_COLORS[3]);
    }
  }

  const save = useHealthMutation(
    () => {
      const input = { ...form, dosage: form.dosage || null, instructions: form.instructions || null, endsOn: form.endsOn || null, times, color };
      return editing ? api.updateMedication(editing.id, input) : api.addMedication(input);
    },
    { success: 'Saved', onSuccess: onClose },
  );
  const remove = useHealthMutation(() => api.deleteMedication(editing!.id), { success: 'Removed', onSuccess: onClose });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()} title={editing ? 'Edit medication' : 'Add medication or supplement'} icon="💊">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        className="space-y-3"
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name">
            <Input required autoFocus value={form.name} onChange={set('name')} placeholder="Vitamin D3" />
          </Field>
          <Field label="Dose">
            <Input value={form.dosage} onChange={set('dosage')} placeholder="1000 IU" />
          </Field>
        </div>
        <Field label="Instructions (optional)">
          <Input value={form.instructions} onChange={set('instructions')} placeholder="With food" />
        </Field>
        <div>
          <div className="label">Times</div>
          <div className="flex flex-wrap items-center gap-2">
            {times.map((t, i) => (
              <div key={i} className="flex items-center gap-1">
                <Input type="time" value={t} required className="w-28" onChange={(e) => setTimes((ts) => ts.map((x, j) => (j === i ? e.target.value : x)))} />
                {times.length > 1 && (
                  <button type="button" onClick={() => setTimes((ts) => ts.filter((_, j) => j !== i))} className="p-1 text-ink-3 hover:text-bad" aria-label="Remove time">
                    <X className="size-4" />
                  </button>
                )}
              </div>
            ))}
            {times.length < 8 && (
              <Button type="button" size="sm" onClick={() => setTimes((ts) => [...ts, '20:00'])}>
                <Plus className="size-3.5" /> Time
              </Button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start">
            <Input type="date" required value={form.startedOn} onChange={set('startedOn')} />
          </Field>
          <Field label="End (optional)">
            <Input type="date" value={form.endsOn} min={form.startedOn} onChange={set('endsOn')} />
          </Field>
        </div>
        <div className="flex gap-2">
          {HABIT_COLORS.map((c) => (
            <button type="button" key={c} onClick={() => setColor(c)} aria-label={c} className={cn('size-7 rounded-full', color === c && 'ring-2 ring-offset-2 ring-offset-[var(--surface)]')} style={{ background: c, ['--tw-ring-color' as string]: c }} />
          ))}
        </div>
        <div className="flex gap-2 pt-2">
          {editing && (
            <Button type="button" variant="danger" onClick={() => remove.mutate()} loading={remove.isPending}>
              <Trash2 className="size-4" />
            </Button>
          )}
          <Button type="submit" variant="primary" size="lg" className="flex-1 justify-center" loading={save.isPending}>
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
