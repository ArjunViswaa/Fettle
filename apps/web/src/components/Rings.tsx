import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, type ReactNode } from 'react';
import { sparkAt } from '../lib/celebrate';

export interface RingSpec {
  key: string;
  value: number;
  target: number;
  color: string;
  label?: string;
}

interface RingsProps {
  rings: RingSpec[];
  size?: number;
  stroke?: number;
  gap?: number;
  children?: ReactNode;
  /** Burst of sparks when a ring closes after the first render. */
  celebrate?: boolean;
}

/**
 * Concentric progress rings, outermost first. A ring past 100% keeps going round on top of
 * itself with a brighter cap, so overshooting is visible without breaking the shape.
 */
export function Rings({ rings, size = 220, stroke = 18, gap = 6, children, celebrate = true }: RingsProps) {
  const reduced = useReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);
  const closed = useRef<Set<string> | null>(null);

  useEffect(() => {
    const now = new Set(rings.filter((r) => r.target > 0 && r.value >= r.target).map((r) => r.key));
    if (closed.current && celebrate) {
      for (const key of now) if (!closed.current.has(key)) sparkAt(wrap.current);
    }
    closed.current = now;
  }, [rings, celebrate]);

  const center = size / 2;
  return (
    <div ref={wrap} className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          {rings.map((r) => (
            <filter key={r.key} id={`glow-${r.key}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          ))}
        </defs>
        {rings.map((r, i) => {
          const radius = center - stroke / 2 - i * (stroke + gap);
          if (radius <= stroke / 2) return null;
          const progress = r.target > 0 ? r.value / r.target : 0;
          const first = Math.min(progress, 1);
          const second = Math.min(Math.max(progress - 1, 0), 1);
          return (
            <g key={r.key}>
              <circle cx={center} cy={center} r={radius} fill="none" stroke={r.color} strokeOpacity={0.14} strokeWidth={stroke} />
              <motion.circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={r.color}
                strokeWidth={stroke}
                strokeLinecap="round"
                initial={{ pathLength: reduced ? first : 0 }}
                animate={{ pathLength: Math.max(first, 0.0001), opacity: first > 0 ? 1 : 0 }}
                transition={{ duration: reduced ? 0 : 1.4, delay: reduced ? 0 : 0.1 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                filter={first >= 1 ? `url(#glow-${r.key})` : undefined}
              />
              {second > 0 && (
                <motion.circle
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={`color-mix(in oklab, ${r.color} 70%, white)`}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: second }}
                  transition={{ duration: reduced ? 0 : 1, delay: reduced ? 0 : 1.3 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
            </g>
          );
        })}
      </svg>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>}
    </div>
  );
}

/** A single ring with content in the middle. */
export function ProgressRing({
  value,
  target,
  color,
  size = 120,
  stroke = 12,
  children,
}: {
  value: number;
  target: number;
  color: string;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  return (
    <Rings rings={[{ key: 'single', value, target, color }]} size={size} stroke={stroke}>
      {children}
    </Rings>
  );
}
