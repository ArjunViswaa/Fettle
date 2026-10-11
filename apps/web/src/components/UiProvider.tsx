import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { todayISO, type Meal, type VitalKind, type Workout } from '@fettle/shared';
import { FoodDialog } from './FoodDialog';
import { MeasurementDialog, MoodDialog, SleepDialog, StepsDialog, VitalDialog, WeightDialog, WorkoutDialog } from './LogDialogs';
import { QuickLogMenu } from './QuickLogMenu';

export type LogTarget =
  | { kind: 'food'; meal?: Meal }
  | { kind: 'workout'; workout?: Workout }
  | { kind: 'weight' }
  | { kind: 'steps' }
  | { kind: 'sleep' }
  | { kind: 'mood' }
  | { kind: 'vital'; vital?: VitalKind }
  | { kind: 'measurement' }
  | { kind: 'menu' };

interface UiState {
  /** The day being viewed on Today and Food; logs default to it. */
  day: string;
  setDay: (day: string) => void;
  open: (target: LogTarget) => void;
}

const UiContext = createContext<UiState | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [day, setDay] = useState(todayISO);
  const [target, setTarget] = useState<LogTarget | null>(null);
  // Keep the last target while the closing animation plays.
  const [shown, setShown] = useState<LogTarget | null>(null);

  const open = useCallback((t: LogTarget) => {
    setShown(t);
    setTarget(t);
  }, []);
  const close = useCallback(() => setTarget(null), []);

  // "Today" rolls over at midnight if the app was left open on the current day.
  const lastToday = useRef(todayISO());
  useEffect(() => {
    const timer = setInterval(() => {
      const now = todayISO();
      if (now === lastToday.current) return;
      const previous = lastToday.current;
      lastToday.current = now;
      setDay((d) => (d === previous ? now : d));
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  // Ctrl/Cmd+K or "l" opens the log menu from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === 'l' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey)) {
        e.preventDefault();
        open({ kind: 'menu' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const value = useMemo(() => ({ day, setDay, open }), [day, open]);
  const is = (kind: LogTarget['kind']) => target?.kind === kind;
  const onOpenChange = (o: boolean) => !o && close();

  return (
    <UiContext.Provider value={value}>
      {children}
      <QuickLogMenu open={is('menu')} onOpenChange={onOpenChange} onPick={open} />
      <FoodDialog open={is('food')} onOpenChange={onOpenChange} day={day} meal={shown?.kind === 'food' ? shown.meal : undefined} />
      <WorkoutDialog open={is('workout')} onOpenChange={onOpenChange} day={day} workout={shown?.kind === 'workout' ? shown.workout : undefined} />
      <WeightDialog open={is('weight')} onOpenChange={onOpenChange} day={day} />
      <StepsDialog open={is('steps')} onOpenChange={onOpenChange} day={day} />
      <SleepDialog open={is('sleep')} onOpenChange={onOpenChange} day={day} />
      <MoodDialog open={is('mood')} onOpenChange={onOpenChange} day={day} />
      <VitalDialog open={is('vital')} onOpenChange={onOpenChange} day={day} initialKind={shown?.kind === 'vital' ? shown.vital : undefined} />
      <MeasurementDialog open={is('measurement')} onOpenChange={onOpenChange} day={day} />
    </UiContext.Provider>
  );
}

export function useUi() {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi outside UiProvider');
  return ctx;
}
