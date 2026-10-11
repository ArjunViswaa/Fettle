import { motion, useReducedMotion } from 'motion/react';
import { useId } from 'react';

/** A glass that fills with two drifting waves as you drink. */
export function WaterGlass({ fraction, width = 92, height = 128 }: { fraction: number; width?: number; height?: number }) {
  const id = useId();
  const reduced = useReducedMotion();
  const level = Math.min(Math.max(fraction, 0), 1);
  const inner = height - 8;
  const top = 4 + inner * (1 - level);
  // One wave period is `width` wide; the path is two periods so it can slide by half and loop.
  const wave = (amp: number) => {
    const w = width;
    return `M0 ${amp} Q ${w / 4} 0 ${w / 2} ${amp} T ${w} ${amp} T ${w * 1.5} ${amp} T ${w * 2} ${amp} V ${height * 2} H 0 Z`;
  };

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <defs>
        <clipPath id={`${id}-clip`}>
          <path d={`M6 4 H${width - 6} L${width - 14} ${height - 4} Q ${width / 2} ${height + 2} 14 ${height - 4} Z`} />
        </clipPath>
        <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--c-water)" stopOpacity="0.95" />
          <stop offset="1" stopColor="color-mix(in oklab, var(--c-water) 60%, #1e3a8a)" stopOpacity="1" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        <rect width={width} height={height} fill="var(--track)" />
        <motion.g initial={{ y: height }} animate={{ y: top }} transition={{ type: 'spring', stiffness: 60, damping: 14, duration: reduced ? 0 : undefined }}>
          <g className="animate-wave-slow" style={{ opacity: 0.45, transformBox: 'fill-box' }}>
            <path d={wave(7)} fill="var(--c-water)" transform="translate(0 -4)" />
          </g>
          <g className="animate-wave" style={{ transformBox: 'fill-box' }}>
            <path d={wave(6)} fill={`url(#${id}-fill)`} />
          </g>
        </motion.g>
      </g>
      <path
        d={`M6 4 H${width - 6} L${width - 14} ${height - 4} Q ${width / 2} ${height + 2} 14 ${height - 4} Z`}
        fill="none"
        stroke="var(--border-strong)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
