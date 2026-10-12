import { motion, useReducedMotion } from 'motion/react';
import { useId } from 'react';
import { AnimatedNumber } from './AnimatedNumber';

/** Half-circle gauge for the daily Fettle score (0–100). */
export function ScoreGauge({ score, size = 200 }: { score: number; size?: number }) {
  const id = useId();
  const reduced = useReducedMotion();
  const stroke = size * 0.085;
  const r = size / 2 - stroke;
  const cx = size / 2;
  const cy = size / 2;
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const label = score >= 85 ? 'Thriving' : score >= 65 ? 'On track' : score >= 40 ? 'Building' : 'Warming up';

  return (
    <div className="relative" style={{ width: size, height: size / 2 + stroke }}>
      <svg width={size} height={size / 2 + stroke} viewBox={`0 0 ${size} ${size / 2 + stroke}`} className="overflow-visible">
        <defs>
          <linearGradient id={`${id}-g`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="var(--c-energy)" />
            <stop offset="45%" stopColor="var(--c-active)" />
            <stop offset="100%" stopColor="var(--c-move)" />
          </linearGradient>
        </defs>
        <path d={arc} fill="none" stroke="var(--track)" strokeWidth={stroke} strokeLinecap="round" />
        <motion.path
          d={arc}
          fill="none"
          stroke={`url(#${id}-g)`}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={{ pathLength: reduced ? score / 100 : 0 }}
          animate={{ pathLength: Math.max(score / 100, 0.001), opacity: score > 0 ? 1 : 0 }}
          transition={{ duration: reduced ? 0 : 1.6, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <AnimatedNumber value={score} format={(v) => String(v)} className="display num text-5xl font-semibold leading-none" />
        <span className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-ink-3">{label}</span>
      </div>
    </div>
  );
}
