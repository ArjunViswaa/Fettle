import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { addDays, relativeDay, todayISO } from '@fettle/shared';
import { cn, fmt } from '../lib/utils';

export function Logo({ size = 34 }: { size?: number }) {
  return <img src="/favicon.svg" width={size} height={size} alt="" className="shrink-0 rounded-[30%] shadow-[0_6px_20px_-8px_var(--brand)]" />;
}

/** Slow drifting colour fields behind content. Pure CSS, GPU-friendly, honours reduced motion. */
export function Aurora({ className, intensity = 1 }: { className?: string; intensity?: number }) {
  const blob = 'absolute rounded-full animate-aurora will-change-transform';
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} style={{ opacity: intensity }}>
      <div className={cn(blob, '-left-[20%] -top-[30%] h-[70%] w-[70%] blur-[110px]')} style={{ background: 'radial-gradient(closest-side, color-mix(in oklab, var(--brand) 45%, transparent), transparent)' }} />
      <div className={cn(blob, '-right-[15%] top-[10%] h-[60%] w-[55%] blur-[120px] [animation-delay:-7s]')} style={{ background: 'radial-gradient(closest-side, color-mix(in oklab, var(--brand-3) 40%, transparent), transparent)' }} />
      <div className={cn(blob, 'bottom-[-35%] left-[25%] h-[60%] w-[60%] blur-[130px] [animation-delay:-13s]')} style={{ background: 'radial-gradient(closest-side, color-mix(in oklab, var(--brand-2) 30%, transparent), transparent)' }} />
    </div>
  );
}

export function PageHeader({ title, subtitle, emoji, actions }: { title: string; subtitle?: ReactNode; emoji?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="display flex items-center gap-2.5 text-[28px] font-semibold leading-tight sm:text-[32px]">
          {emoji && (
            <motion.span initial={{ scale: 0.4, rotate: -20, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }}>
              {emoji}
            </motion.span>
          )}
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Previous / next day with an animated label. Never goes past today. */
export function DayNav({ day, onChange }: { day: string; onChange: (day: string) => void }) {
  const today = todayISO();
  return (
    <div className="flex items-center gap-1 rounded-2xl border border-line bg-surface p-1">
      <button className="rounded-xl p-2 text-ink-2 hover:bg-surface-2 hover:text-ink" onClick={() => onChange(addDays(day, -1))} aria-label="Previous day">
        <ChevronLeft className="size-4" />
      </button>
      <label className="relative min-w-[120px] cursor-pointer overflow-hidden text-center text-sm font-medium">
        <motion.span key={day} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="block px-2">
          {relativeDay(day, today)}
        </motion.span>
        <input
          type="date"
          value={day}
          max={today}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Pick a day"
        />
      </label>
      <button
        className="rounded-xl p-2 text-ink-2 hover:bg-surface-2 hover:text-ink disabled:opacity-30"
        onClick={() => onChange(addDays(day, 1))}
        disabled={day >= today}
        aria-label="Next day"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

/** A labelled bar that fills towards a target. */
export function MeterBar({ label, value, target, color, unit = 'g', className }: { label: string; value: number; target: number; color: string; unit?: string; className?: string }) {
  const ratio = target > 0 ? value / target : 0;
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px]">
        <span className="font-medium text-ink-2">{label}</span>
        <span className="num text-ink-3">
          <span className={cn('font-semibold', ratio > 1.15 ? 'text-warn' : 'text-ink')}>{fmt(value)}</span> / {fmt(target)}
          {unit}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[var(--track)]">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(ratio, 1) * 100}%` }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}

export function Stepper({ value, onChange, step = 1, min = 0, max = Infinity, suffix }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; suffix?: string }) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v * 100) / 100)));
  return (
    <div className="flex items-center gap-2">
      <button type="button" className="flex size-10 items-center justify-center rounded-xl border border-line bg-surface-2 hover:bg-surface-3 active:scale-95" onClick={() => set(value - step)} aria-label="Less">
        <Minus className="size-4" />
      </button>
      <div className="relative">
        <input type="number" inputMode="decimal" className="input w-24 text-center num font-semibold" value={value} step={step} min={min} max={max} onChange={(e) => set(Number(e.target.value))} />
        {suffix && <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-3">{suffix}</span>}
      </div>
      <button type="button" className="flex size-10 items-center justify-center rounded-xl border border-line bg-surface-2 hover:bg-surface-3 active:scale-95" onClick={() => set(value + step)} aria-label="More">
        <Plus className="size-4" />
      </button>
    </div>
  );
}

/** Row of 1–5 emoji buttons with a springy selection. */
export function EmojiScale({ value, onChange, options }: { value: number; onChange: (v: number) => void; options: ReadonlyArray<{ value: number; emoji: string; label: string }> }) {
  return (
    <div className="flex justify-between gap-1.5" role="radiogroup">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <motion.button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.label}
            onClick={() => onChange(o.value)}
            whileTap={{ scale: 0.85 }}
            animate={{ scale: active ? 1.12 : 1, opacity: active ? 1 : 0.55 }}
            transition={{ type: 'spring', stiffness: 400, damping: 18 }}
            className={cn('flex flex-1 flex-col items-center gap-1 rounded-2xl border py-2.5', active ? 'border-line-strong bg-surface-2' : 'border-transparent')}
          >
            <span className="text-[28px] leading-none">{o.emoji}</span>
            <span className="text-[11px] text-ink-3">{o.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

export function Stat({ label, value, unit, sub, color }: { label: string; value: ReactNode; unit?: string; sub?: ReactNode; color?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface-2/60 p-3.5">
      <div className="text-xs font-medium text-ink-3">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="display num text-2xl font-semibold" style={color ? { color } : undefined}>
          {value}
        </span>
        {unit && <span className="text-xs text-ink-3">{unit}</span>}
      </div>
      {sub && <div className="mt-0.5 text-xs text-ink-3">{sub}</div>}
    </div>
  );
}
