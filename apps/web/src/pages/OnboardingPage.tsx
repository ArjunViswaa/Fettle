import { useNavigate } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  ACTIVITY_INFO,
  ACTIVITY_LEVELS,
  ageOn,
  bmi,
  bmiCategory,
  CM_PER_IN,
  displayToKg,
  GOAL_INFO,
  GOALS,
  kgToDisplay,
  minutesToHM,
  suggestTargets,
  todayISO,
  weightUnit,
  type ActivityLevel,
  type Goal,
  type Sex,
  type UnitSystem,
} from '@fettle/shared';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { Aurora, Logo } from '../components/Bits';
import { Rings } from '../components/Rings';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Field';
import { Segmented } from '../components/ui/Segmented';
import { api } from '../lib/api';
import { celebrate } from '../lib/celebrate';
import { queryClient, useMe } from '../lib/queries';
import { cn, fmt } from '../lib/utils';

const STEPS = ['units', 'you', 'body', 'activity', 'goal', 'plan'] as const;

export function OnboardingPage() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [saving, setSaving] = useState(false);

  const [units, setUnits] = useState<UnitSystem>('metric');
  const [sex, setSex] = useState<Sex>('female');
  const [birthDate, setBirthDate] = useState('1995-01-01');
  const [heightCm, setHeightCm] = useState(168);
  const [weightKg, setWeightKg] = useState(68);
  const [activity, setActivity] = useState<ActivityLevel>('light');
  const [goal, setGoal] = useState<Goal>('maintain');
  const [targetKg, setTargetKg] = useState(64);
  const [rate, setRate] = useState(0.5);

  const age = ageOn(birthDate, todayISO());
  const targets = useMemo(
    () => suggestTargets({ sex, weightKg, heightCm, age, activityLevel: activity, goal, weeklyRateKg: goal === 'maintain' ? 0 : rate }),
    [sex, weightKg, heightCm, age, activity, goal, rate],
  );

  // Ignore clicks while a step is still sliding out, so a double-click can't skip a step.
  const sliding = useRef(false);
  const go = (delta: number) => {
    if (sliding.current) return;
    sliding.current = true;
    setTimeout(() => (sliding.current = false), 350);
    setDirection(delta);
    setStep((s) => Math.min(STEPS.length - 1, Math.max(0, s + delta)));
    if (step + delta === STEPS.length - 1) setTimeout(celebrate, 450);
  };

  const finish = async () => {
    setSaving(true);
    try {
      await api.saveProfile({
        sex,
        birthDate,
        heightCm,
        activityLevel: activity,
        goal,
        targetWeightKg: goal === 'maintain' ? null : targetKg,
        weeklyRateKg: goal === 'maintain' ? 0 : rate,
        unitSystem: units,
        startWeightKg: weightKg,
        startDate: todayISO(),
        calorieTarget: targets.calories,
        proteinTargetG: targets.proteinG,
        carbsTargetG: targets.carbsG,
        fatTargetG: targets.fatG,
        fiberTargetG: targets.fiberG,
        waterTargetMl: targets.waterMl,
        stepTarget: targets.steps,
        sleepTargetMinutes: targets.sleepMinutes,
        activeMinutesTarget: targets.activeMinutes,
      });
      await queryClient.invalidateQueries();
      navigate({ to: '/' });
    } catch (e) {
      toast.error((e as Error).message);
      setSaving(false);
    }
  };

  const ageOk = age >= 13 && age <= 110;
  const canContinue = STEPS[step] !== 'you' || ageOk;

  return (
    <div className="relative flex min-h-screen flex-col items-center overflow-hidden px-4 py-8">
      <Aurora intensity={0.7} />
      <div className="relative w-full max-w-xl">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo size={32} />
            <span className="display text-lg font-semibold">Fettle</span>
          </div>
          <span className="text-sm text-ink-3">
            {step + 1} / {STEPS.length}
          </span>
        </div>
        <div className="mb-8 h-1.5 overflow-hidden rounded-full bg-[var(--track)]">
          <motion.div className="brand-gradient h-full rounded-full" animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
        </div>

        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={step}
            custom={direction}
            initial={{ opacity: 0, x: 40 * direction }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 * direction }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="card glass p-6 sm:p-8"
          >
            {STEPS[step] === 'units' && (
              <Step title={`Hi ${me?.name?.split(' ')[0] ?? 'there'} 👋`} subtitle="Let's tune Fettle to you. First, how do you measure things?">
                <div className="grid grid-cols-2 gap-3">
                  <ChoiceCard active={units === 'metric'} onClick={() => setUnits('metric')} emoji="📏" title="Metric" hint="kg · cm · ml" />
                  <ChoiceCard active={units === 'imperial'} onClick={() => setUnits('imperial')} emoji="🦅" title="Imperial" hint="lb · in · fl oz" />
                </div>
              </Step>
            )}

            {STEPS[step] === 'you' && (
              <Step title="About you" subtitle="Used only to estimate your energy needs.">
                <div className="grid grid-cols-2 gap-3">
                  <ChoiceCard active={sex === 'female'} onClick={() => setSex('female')} emoji="🙋‍♀️" title="Female" />
                  <ChoiceCard active={sex === 'male'} onClick={() => setSex('male')} emoji="🙋‍♂️" title="Male" />
                </div>
                <label className="mt-5 block">
                  <span className="label">Date of birth</span>
                  <Input type="date" value={birthDate} max={todayISO()} onChange={(e) => setBirthDate(e.target.value)} />
                  <span className={cn('mt-1.5 block text-xs', ageOk ? 'text-ink-3' : 'text-bad')}>{ageOk ? `${age} years old` : 'Fettle is for people aged 13 and over.'}</span>
                </label>
              </Step>
            )}

            {STEPS[step] === 'body' && (
              <Step title="Your body today" subtitle="No judgement, just a starting point.">
                <HeightInput units={units} cm={heightCm} onChange={setHeightCm} />
                <WeightInput units={units} kg={weightKg} onChange={setWeightKg} label="Current weight" />
                <BmiBadge weightKg={weightKg} heightCm={heightCm} />
              </Step>
            )}

            {STEPS[step] === 'activity' && (
              <Step title="How active are you?" subtitle="On a typical week, not your best one.">
                <div className="space-y-2">
                  {ACTIVITY_LEVELS.map((level, i) => (
                    <motion.button
                      key={level}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => setActivity(level)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors',
                        activity === level ? 'border-[color-mix(in_oklab,var(--brand)_60%,transparent)] bg-[color-mix(in_oklab,var(--brand)_12%,transparent)]' : 'border-line hover:border-line-strong',
                      )}
                    >
                      <span className="flex gap-0.5">
                        {Array.from({ length: 5 }, (_, b) => (
                          <span key={b} className="h-5 w-1.5 rounded-full" style={{ background: b <= i ? 'var(--brand)' : 'var(--track)' }} />
                        ))}
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-semibold">{ACTIVITY_INFO[level].label}</span>
                        <span className="block text-xs text-ink-3">{ACTIVITY_INFO[level].hint}</span>
                      </span>
                    </motion.button>
                  ))}
                </div>
              </Step>
            )}

            {STEPS[step] === 'goal' && (
              <Step title="What's your goal?" subtitle="You can change this any time.">
                <div className="grid grid-cols-3 gap-2">
                  {GOALS.map((g) => (
                    <ChoiceCard key={g} active={goal === g} onClick={() => setGoal(g)} emoji={GOAL_INFO[g].emoji} title={GOAL_INFO[g].label} hint={GOAL_INFO[g].hint} />
                  ))}
                </div>
                {goal !== 'maintain' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-5 space-y-4 overflow-hidden">
                    <WeightInput units={units} kg={targetKg} onChange={setTargetKg} label="Target weight" />
                    <div>
                      <div className="mb-1.5 flex justify-between text-sm">
                        <span className="label mb-0">Pace</span>
                        <span className="num font-semibold">
                          {kgToDisplay(rate, units)} {weightUnit(units)} / week
                        </span>
                      </div>
                      <input type="range" min={0.1} max={goal === 'gain' ? 0.5 : 1} step={0.05} value={rate} onChange={(e) => setRate(Number(e.target.value))} className="w-full accent-[var(--brand)]" />
                      <div className="flex justify-between text-xs text-ink-3">
                        <span>Gentle</span>
                        <span>{goal === 'lose' ? 'Aggressive' : 'Faster'}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </Step>
            )}

            {STEPS[step] === 'plan' && (
              <Step title="Your daily plan ✨" subtitle="Built from your profile with proven formulas. Fine-tune any of it later in Settings.">
                <div className="flex flex-col items-center gap-6 sm:flex-row">
                  <Rings
                    size={180}
                    stroke={16}
                    celebrate={false}
                    rings={[
                      { key: 'cal', value: 1, target: 1, color: 'var(--c-energy)' },
                      { key: 'move', value: 1, target: 1, color: 'var(--c-move)' },
                      { key: 'water', value: 1, target: 1, color: 'var(--c-water)' },
                    ]}
                  >
                    <AnimatedNumber value={targets.calories} format={(v) => fmt(v)} className="display num text-3xl font-semibold" />
                    <span className="text-xs text-ink-3">kcal / day</span>
                  </Rings>
                  <div className="grid flex-1 grid-cols-2 gap-2">
                    <PlanStat label="Protein" value={`${targets.proteinG} g`} color="var(--c-protein)" />
                    <PlanStat label="Carbs" value={`${targets.carbsG} g`} color="var(--c-carbs)" />
                    <PlanStat label="Fat" value={`${targets.fatG} g`} color="var(--c-fat)" />
                    <PlanStat label="Water" value={units === 'imperial' ? `${Math.round(targets.waterMl / 29.57)} fl oz` : `${(targets.waterMl / 1000).toFixed(2)} L`} color="var(--c-water)" />
                    <PlanStat label="Steps" value={fmt(targets.steps)} color="var(--c-move)" />
                    <PlanStat label="Sleep" value={minutesToHM(targets.sleepMinutes)} color="var(--c-sleep)" />
                  </div>
                </div>
              </Step>
            )}

            <div className="mt-8 flex items-center justify-between gap-3">
              <Button variant="ghost" onClick={() => go(-1)} disabled={step === 0} className={step === 0 ? 'invisible' : ''}>
                <ArrowLeft className="size-4" /> Back
              </Button>
              {step < STEPS.length - 1 ? (
                <Button variant="primary" size="lg" onClick={() => go(1)} disabled={!canContinue}>
                  Continue <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button variant="primary" size="lg" onClick={finish} loading={saving}>
                  Let's go <ArrowRight className="size-4" />
                </Button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Step({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div>
      <h1 className="display text-2xl font-semibold sm:text-3xl">{title}</h1>
      <p className="mb-6 mt-1.5 text-sm text-ink-2">{subtitle}</p>
      {children}
    </div>
  );
}

function ChoiceCard({ active, onClick, emoji, title, hint }: { active: boolean; onClick: () => void; emoji: string; title: string; hint?: string }) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1.5 rounded-2xl border p-4 text-center transition-colors',
        active ? 'border-[color-mix(in_oklab,var(--brand)_60%,transparent)] bg-[color-mix(in_oklab,var(--brand)_12%,transparent)]' : 'border-line hover:border-line-strong',
      )}
    >
      <motion.span animate={{ scale: active ? 1.15 : 1 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }} className="text-3xl">
        {emoji}
      </motion.span>
      <span className="text-sm font-semibold">{title}</span>
      {hint && <span className="text-[11px] leading-tight text-ink-3">{hint}</span>}
    </motion.button>
  );
}

function PlanStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface-2/60 px-3 py-2.5">
      <div className="text-[11px] text-ink-3">{label}</div>
      <div className="num font-semibold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

export function HeightInput({ units, cm, onChange }: { units: UnitSystem; cm: number; onChange: (cm: number) => void }) {
  const totalIn = Math.round(cm / CM_PER_IN);
  return (
    <div className="mb-4">
      <span className="label">Height</span>
      {units === 'metric' ? (
        <div className="relative">
          <Input type="number" min={80} max={260} value={Math.round(cm)} onChange={(e) => onChange(Number(e.target.value))} />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-ink-3">cm</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <Input type="number" min={3} max={8} value={Math.floor(totalIn / 12)} onChange={(e) => onChange((Number(e.target.value) * 12 + (totalIn % 12)) * CM_PER_IN)} />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-ink-3">ft</span>
          </div>
          <div className="relative">
            <Input type="number" min={0} max={11} value={totalIn % 12} onChange={(e) => onChange((Math.floor(totalIn / 12) * 12 + Number(e.target.value)) * CM_PER_IN)} />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-ink-3">in</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function WeightInput({ units, kg, onChange, label }: { units: UnitSystem; kg: number; onChange: (kg: number) => void; label: string }) {
  return (
    <div className="mb-4">
      <span className="label">{label}</span>
      <div className="relative">
        <Input type="number" step="0.1" min={20} max={900} value={kgToDisplay(kg, units)} onChange={(e) => onChange(displayToKg(Number(e.target.value), units))} />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-ink-3">{weightUnit(units)}</span>
      </div>
    </div>
  );
}

function BmiBadge({ weightKg, heightCm }: { weightKg: number; heightCm: number }) {
  if (!weightKg || !heightCm) return null;
  const value = bmi(weightKg, heightCm);
  const cat = bmiCategory(value);
  const tone = { low: 'var(--c-water)', good: 'var(--good)', warn: 'var(--warn)', high: 'var(--bad)' }[cat.tone];
  return (
    <motion.div layout className="flex items-center justify-between rounded-2xl border border-line bg-surface-2/60 px-4 py-3 text-sm">
      <span className="text-ink-2">Body mass index</span>
      <span className="num font-semibold" style={{ color: tone }}>
        {value.toFixed(1)} · {cat.label}
      </span>
    </motion.div>
  );
}
