import { motion } from 'motion/react';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  addDays,
  celsiusToDisplay,
  displayToCelsius,
  displayToCm,
  displayToKg,
  displayToKm,
  distanceUnit,
  GLUCOSE_CONTEXTS,
  INTENSITIES,
  kgToDisplay,
  lengthUnit,
  minutesToHM,
  MOOD_INFO,
  MOOD_TAGS,
  VITAL_INFO,
  VITAL_KINDS,
  weightUnit,
  WORKOUT_INFO,
  WORKOUT_TYPES,
  workoutCalories,
  type GlucoseContext,
  type Intensity,
  type VitalKind,
  type Workout,
  type WorkoutType,
} from '@fettle/shared';
import { api } from '../lib/api';
import { useHealthMutation, useProfile, useUnits } from '../lib/queries';
import { cn, fmt, fromLocalInput, toLocalInput } from '../lib/utils';
import { EmojiScale, Stepper } from './Bits';
import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';
import { Field, Input } from './ui/Field';
import { Segmented } from './ui/Segmented';

interface BaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: string;
}

const optionalNumber = (v: string) => (v.trim() === '' ? null : Number(v));

function SubmitRow({ loading, label, extra }: { loading: boolean; label: string; extra?: ReactNode }) {
  return (
    <div className="mt-5 flex gap-2">
      {extra}
      <Button type="submit" variant="primary" size="lg" className="flex-1 justify-center" loading={loading}>
        {label}
      </Button>
    </div>
  );
}

// Workout --------------------------------------------------------------------

export function WorkoutDialog({ open, onOpenChange, day, workout }: BaseProps & { workout?: Workout }) {
  const units = useUnits();
  const profile = useProfile().data;
  const [type, setType] = useState<WorkoutType>('walking');
  const [intensity, setIntensity] = useState<Intensity>('moderate');
  const [duration, setDuration] = useState(30);
  const [title, setTitle] = useState('');
  const [distance, setDistance] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [calories, setCalories] = useState('');
  const [date, setDate] = useState(day);

  useEffect(() => {
    if (!open) return;
    setType(workout?.type ?? 'walking');
    setIntensity(workout?.intensity ?? 'moderate');
    setDuration(workout?.durationMin ?? 30);
    setTitle(workout?.title ?? '');
    setDistance(workout?.distanceKm ? String(+(units === 'imperial' ? workout.distanceKm / 1.609344 : workout.distanceKm).toFixed(2)) : '');
    setHeartRate(workout?.avgHeartRate ? String(workout.avgHeartRate) : '');
    setCalories(workout ? String(workout.caloriesBurned) : '');
    setDate(workout?.performedOn ?? day);
  }, [open, workout, day, units]);

  const estimate = workoutCalories(type, intensity, duration, profile?.latestWeightKg ?? 70);
  const save = useHealthMutation(
    () => {
      const input = {
        performedOn: date,
        type,
        intensity,
        durationMin: duration,
        title: title || null,
        distanceKm: distance ? displayToKm(Number(distance), units) : null,
        avgHeartRate: optionalNumber(heartRate),
        caloriesBurned: optionalNumber(calories),
        notes: null,
      };
      return workout ? api.updateWorkout(workout.id, input) : api.addWorkout(input);
    },
    { success: (w) => `${WORKOUT_INFO[w.type].emoji} ${fmt(w.caloriesBurned)} kcal burned. Nice work!`, onSuccess: () => onOpenChange(false) },
  );
  const remove = useHealthMutation(() => api.deleteWorkout(workout!.id), { success: 'Workout deleted', onSuccess: () => onOpenChange(false) });

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={workout ? 'Edit workout' : 'Log a workout'} icon={WORKOUT_INFO[type].emoji} className="sm:max-w-xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
          {WORKOUT_TYPES.map((t) => (
            <motion.button
              type="button"
              key={t}
              whileTap={{ scale: 0.9 }}
              onClick={() => setType(t)}
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-2xl border py-2 text-[11px] transition-colors',
                t === type ? 'border-[color-mix(in_oklab,var(--c-move)_60%,transparent)] bg-[color-mix(in_oklab,var(--c-move)_14%,transparent)] text-ink' : 'border-line text-ink-3 hover:text-ink-2',
              )}
            >
              <span className="text-xl">{WORKOUT_INFO[t].emoji}</span>
              {WORKOUT_INFO[t].label}
            </motion.button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <div className="label">Duration (min)</div>
            <Stepper value={duration} onChange={setDuration} step={5} min={1} max={600} />
          </div>
          <div>
            <div className="label">Intensity</div>
            <Segmented value={intensity} onChange={setIntensity} options={INTENSITIES.map((i) => ({ value: i, label: i[0]!.toUpperCase() + i.slice(1) }))} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="Date">
            <Input type="date" value={date} max={addDays(day, 1)} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label="Name (optional)">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Morning run" />
          </Field>
          {WORKOUT_INFO[type].distance && (
            <Field label={`Distance (${distanceUnit(units)})`}>
              <Input type="number" step="any" min={0} value={distance} onChange={(e) => setDistance(e.target.value)} />
            </Field>
          )}
          <Field label="Avg heart rate (bpm)">
            <Input type="number" min={30} max={240} value={heartRate} onChange={(e) => setHeartRate(e.target.value)} />
          </Field>
          <Field label="Calories burned" hint={`Leave empty to use our estimate: ~${fmt(estimate)} kcal`} className="col-span-2">
            <Input type="number" min={0} value={calories} onChange={(e) => setCalories(e.target.value)} placeholder={String(estimate)} />
          </Field>
        </div>
        <SubmitRow
          loading={save.isPending}
          label={workout ? 'Save changes' : `Log ${minutesToHM(duration)} of ${WORKOUT_INFO[type].label.toLowerCase()}`}
          extra={
            workout && (
              <Button type="button" variant="danger" size="lg" loading={remove.isPending} onClick={() => remove.mutate()}>
                Delete
              </Button>
            )
          }
        />
      </form>
    </Dialog>
  );
}

// Weight ---------------------------------------------------------------------

export function WeightDialog({ open, onOpenChange, day }: BaseProps) {
  const units = useUnits();
  const profile = useProfile().data;
  const [value, setValue] = useState(70);
  const [bodyFat, setBodyFat] = useState('');
  const [date, setDate] = useState(day);

  useEffect(() => {
    if (!open) return;
    setValue(kgToDisplay(profile?.latestWeightKg ?? 70, units));
    setBodyFat('');
    setDate(day);
  }, [open, profile?.latestWeightKg, units, day]);

  const save = useHealthMutation(
    () => api.saveWeight({ measuredOn: date, weightKg: displayToKg(value, units), bodyFatPct: optionalNumber(bodyFat), note: null }),
    {
      success: (w) => {
        const before = profile?.latestWeightKg;
        if (!before) return 'Weigh-in saved';
        const diff = kgToDisplay(w.weightKg, units) - kgToDisplay(before, units);
        return `Weigh-in saved (${diff > 0 ? '+' : ''}${diff.toFixed(1)} ${weightUnit(units)})`;
      },
      onSuccess: () => onOpenChange(false),
    },
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Weigh in" icon="⚖️" description="Same time each day (morning, after the bathroom) gives the cleanest trend.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="display num text-6xl font-semibold text-weight">
            {value.toFixed(1)}
            <span className="ml-1 text-xl text-ink-3">{weightUnit(units)}</span>
          </div>
          <input
            type="range"
            min={Math.max(20, Math.round(value - 15))}
            max={Math.round(value + 15)}
            step={0.1}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            className="w-full accent-[var(--c-weight)]"
            aria-label="Weight"
          />
          <Stepper value={value} onChange={setValue} step={0.1} min={20} max={900} suffix={weightUnit(units)} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="Date">
            <Input type="date" value={date} max={day} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label="Body fat % (optional)">
            <Input type="number" step="0.1" min={2} max={70} value={bodyFat} onChange={(e) => setBodyFat(e.target.value)} />
          </Field>
        </div>
        <SubmitRow loading={save.isPending} label="Save weigh-in" />
      </form>
    </Dialog>
  );
}

// Steps ----------------------------------------------------------------------

export function StepsDialog({ open, onOpenChange, day }: BaseProps) {
  const [steps, setSteps] = useState('');
  const [active, setActive] = useState('');
  const [floors, setFloors] = useState('');
  const [date, setDate] = useState(day);
  useEffect(() => {
    if (open) {
      setSteps('');
      setActive('');
      setFloors('');
      setDate(day);
    }
  }, [open, day]);

  const save = useHealthMutation(
    () => api.saveSteps({ day: date, steps: Number(steps), activeMinutes: optionalNumber(active), floors: optionalNumber(floors) }),
    { success: (s) => `${fmt(s.steps)} steps saved 👟`, onSuccess: () => onOpenChange(false) },
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Steps" icon="👟" description="Copy the day's total from your phone or watch. Saving again replaces it.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        className="space-y-3"
      >
        <Field label="Steps">
          <Input type="number" inputMode="numeric" min={0} max={150000} required autoFocus value={steps} onChange={(e) => setSteps(e.target.value)} className="h-14 text-2xl font-semibold" />
        </Field>
        <div className="flex flex-wrap gap-2">
          {[2000, 5000, 8000, 10000, 12000].map((n) => (
            <button type="button" key={n} className="chip" data-active={Number(steps) === n} onClick={() => setSteps(String(n))}>
              {fmt(n)}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Date">
            <Input type="date" value={date} max={day} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Active minutes">
            <Input type="number" min={0} max={1440} value={active} onChange={(e) => setActive(e.target.value)} />
          </Field>
          <Field label="Floors">
            <Input type="number" min={0} value={floors} onChange={(e) => setFloors(e.target.value)} />
          </Field>
        </div>
        <SubmitRow loading={save.isPending} label="Save steps" />
      </form>
    </Dialog>
  );
}

// Sleep ----------------------------------------------------------------------

const SLEEP_QUALITY = [
  { value: 1, emoji: '😵', label: 'Awful' },
  { value: 2, emoji: '🥱', label: 'Poor' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '😌', label: 'Good' },
  { value: 5, emoji: '🤩', label: 'Great' },
] as const;

export function SleepDialog({ open, onOpenChange, day }: BaseProps) {
  const defaults = useMemo(() => {
    const wake = new Date(`${day}T07:00:00`);
    const bed = new Date(`${addDays(day, -1)}T23:00:00`);
    return { bed: toLocalInput(bed), wake: toLocalInput(wake) };
  }, [day]);
  const [bed, setBed] = useState(defaults.bed);
  const [wake, setWake] = useState(defaults.wake);
  const [quality, setQuality] = useState(4);
  const [awakenings, setAwakenings] = useState(0);

  useEffect(() => {
    if (open) {
      setBed(defaults.bed);
      setWake(defaults.wake);
      setQuality(4);
      setAwakenings(0);
    }
  }, [open, defaults]);

  const minutes = Math.round((new Date(wake).getTime() - new Date(bed).getTime()) / 60000);
  const save = useHealthMutation(
    () => api.saveSleep({ bedAt: fromLocalInput(bed), wakeAt: fromLocalInput(wake), sleptOn: wake.slice(0, 10), quality, awakenings, notes: null }),
    { success: (s) => `${minutesToHM(s.minutes)} of sleep logged 🌙`, onSuccess: () => onOpenChange(false) },
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Log sleep" icon="🌙">
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="mb-4 rounded-2xl bg-[color-mix(in_oklab,var(--c-sleep)_12%,var(--surface))] p-4 text-center">
          <div className="display num text-5xl font-semibold text-sleep">{minutes > 0 ? minutesToHM(minutes) : '—'}</div>
          <div className="mt-1 text-xs text-ink-3">time in bed</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Went to bed">
            <Input type="datetime-local" value={bed} onChange={(e) => setBed(e.target.value)} required />
          </Field>
          <Field label="Woke up">
            <Input type="datetime-local" value={wake} onChange={(e) => setWake(e.target.value)} required />
          </Field>
        </div>
        <div className="mt-4">
          <div className="label">How did you sleep?</div>
          <EmojiScale value={quality} onChange={setQuality} options={SLEEP_QUALITY} />
        </div>
        <div className="mt-4 flex items-center justify-between">
          <span className="label mb-0">Times you woke up</span>
          <Stepper value={awakenings} onChange={setAwakenings} min={0} max={30} />
        </div>
        <SubmitRow loading={save.isPending} label="Save sleep" />
      </form>
    </Dialog>
  );
}

// Mood -----------------------------------------------------------------------

const LEVELS = (emojis: string[], labels: string[]) => emojis.map((emoji, i) => ({ value: i + 1, emoji, label: labels[i]! }));
const ENERGY = LEVELS(['🪫', '😪', '🙂', '⚡', '🚀'], ['Drained', 'Tired', 'Steady', 'Energised', 'Buzzing']);
const STRESS = LEVELS(['🧘', '🙂', '😬', '😣', '🤯'], ['Calm', 'Mild', 'Tense', 'High', 'Overwhelmed']);

export function MoodDialog({ open, onOpenChange, day }: BaseProps) {
  const [mood, setMood] = useState(4);
  const [energy, setEnergy] = useState(3);
  const [stress, setStress] = useState(2);
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState('');
  useEffect(() => {
    if (open) {
      setMood(4);
      setEnergy(3);
      setStress(2);
      setTags([]);
      setNote('');
    }
  }, [open]);

  const save = useHealthMutation(() => api.addMood({ loggedOn: day, mood, energy, stress, tags, note: note || null }), {
    success: () => `Checked in: feeling ${MOOD_INFO[mood - 1]!.label.toLowerCase()} ${MOOD_INFO[mood - 1]!.emoji}`,
    onSuccess: () => onOpenChange(false),
  });
  const current = MOOD_INFO[mood - 1]!;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="How are you feeling?" icon={current.emoji}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        className="space-y-5"
      >
        <motion.div
          className="rounded-3xl p-4"
          animate={{ background: `color-mix(in oklab, ${current.color} 16%, var(--surface))` }}
          transition={{ duration: 0.4 }}
        >
          <EmojiScale value={mood} onChange={setMood} options={MOOD_INFO} />
        </motion.div>
        <div>
          <div className="label">Energy</div>
          <EmojiScale value={energy} onChange={setEnergy} options={ENERGY} />
        </div>
        <div>
          <div className="label">Stress</div>
          <EmojiScale value={stress} onChange={setStress} options={STRESS} />
        </div>
        <div>
          <div className="label">What's shaping it?</div>
          <div className="flex flex-wrap gap-1.5">
            {MOOD_TAGS.map((t) => (
              <button
                type="button"
                key={t}
                className="chip capitalize"
                data-active={tags.includes(t)}
                onClick={() => setTags((list) => (list.includes(t) ? list.filter((x) => x !== t) : [...list, t]))}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <Field label="A line for your journal (optional)">
          <textarea className="input min-h-20" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What went well today?" maxLength={1000} />
        </Field>
        <SubmitRow loading={save.isPending} label="Check in" />
      </form>
    </Dialog>
  );
}

// Vitals ---------------------------------------------------------------------

export function VitalDialog({ open, onOpenChange, day, initialKind }: BaseProps & { initialKind?: VitalKind }) {
  const units = useUnits();
  const [kind, setKind] = useState<VitalKind>('heart_rate');
  const [value, setValue] = useState('');
  const [value2, setValue2] = useState('');
  const [context, setContext] = useState<GlucoseContext>('fasting');
  const [at, setAt] = useState(toLocalInput(new Date()));

  useEffect(() => {
    if (open) {
      setKind(initialKind ?? 'heart_rate');
      setValue('');
      setValue2('');
      setAt(toLocalInput(day === toLocalInput(new Date()).slice(0, 10) ? new Date() : new Date(`${day}T09:00:00`)));
    }
  }, [open, initialKind, day]);

  const info = VITAL_INFO[kind];
  const isTemp = kind === 'temperature';
  const unitLabel = isTemp && units === 'imperial' ? '°F' : info.unit;
  const save = useHealthMutation(
    () => {
      const raw = Number(value);
      return api.addVital({
        kind,
        measuredAt: fromLocalInput(at),
        measuredOn: at.slice(0, 10),
        value: isTemp ? Math.round(displayToCelsius(raw, units) * 10) / 10 : raw,
        value2: kind === 'blood_pressure' ? Number(value2) : null,
        context: kind === 'glucose' ? context : null,
        note: null,
      });
    },
    { success: `${info.label} saved`, onSuccess: () => onOpenChange(false) },
  );
  const normal = isTemp ? info.normal.map((v) => celsiusToDisplay(v, units)) : info.normal;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Log a reading" icon={info.emoji}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        className="space-y-4"
      >
        <div className="flex flex-wrap gap-1.5">
          {VITAL_KINDS.map((k) => (
            <button type="button" key={k} className="chip" data-active={k === kind} onClick={() => setKind(k)}>
              {VITAL_INFO[k].emoji} {VITAL_INFO[k].label}
            </button>
          ))}
        </div>
        <div className={cn('grid gap-3', kind === 'blood_pressure' ? 'grid-cols-2' : 'grid-cols-1')}>
          <Field label={kind === 'blood_pressure' ? 'Systolic (top)' : `${info.label} (${unitLabel})`} hint={`Typical: ${normal[0]}–${normal[1]} ${unitLabel}`}>
            <Input type="number" step="any" required autoFocus value={value} onChange={(e) => setValue(e.target.value)} className="h-14 text-2xl font-semibold" />
          </Field>
          {kind === 'blood_pressure' && (
            <Field label="Diastolic (bottom)" hint={`Typical: ${info.normal2![0]}–${info.normal2![1]} mmHg`}>
              <Input type="number" required value={value2} onChange={(e) => setValue2(e.target.value)} className="h-14 text-2xl font-semibold" />
            </Field>
          )}
        </div>
        {kind === 'glucose' && (
          <div className="flex flex-wrap gap-1.5">
            {GLUCOSE_CONTEXTS.map((c) => (
              <button type="button" key={c} className="chip capitalize" data-active={c === context} onClick={() => setContext(c)}>
                {c.replace('_', ' ')}
              </button>
            ))}
          </div>
        )}
        <Field label="When">
          <Input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} required />
        </Field>
        <SubmitRow loading={save.isPending} label="Save reading" />
      </form>
    </Dialog>
  );
}

// Measurements ---------------------------------------------------------------

const PARTS = [
  ['waistCm', 'Waist'],
  ['hipsCm', 'Hips'],
  ['chestCm', 'Chest'],
  ['neckCm', 'Neck'],
  ['armCm', 'Upper arm'],
  ['thighCm', 'Thigh'],
] as const;

export function MeasurementDialog({ open, onOpenChange, day }: BaseProps) {
  const units = useUnits();
  const [values, setValues] = useState<Record<string, string>>({});
  const [date, setDate] = useState(day);
  useEffect(() => {
    if (open) {
      setValues({});
      setDate(day);
    }
  }, [open, day]);

  const save = useHealthMutation(
    () => {
      const parsed = Object.fromEntries(PARTS.map(([key]) => [key, values[key] ? Math.round(displayToCm(Number(values[key]), units) * 10) / 10 : null]));
      return api.saveMeasurement({ measuredOn: date, ...parsed });
    },
    { success: 'Measurements saved 📏', onSuccess: () => onOpenChange(false) },
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Body measurements" icon="📏" description="Measure at the widest point, tape snug but not tight. Waist, neck (and hips) give a body-fat estimate.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          {PARTS.map(([key, label]) => (
            <Field key={key} label={`${label} (${lengthUnit(units)})`}>
              <Input type="number" step="0.1" min={0} value={values[key] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))} />
            </Field>
          ))}
          <Field label="Date" className="col-span-2">
            <Input type="date" value={date} max={day} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <SubmitRow loading={save.isPending} label="Save measurements" />
      </form>
    </Dialog>
  );
}
