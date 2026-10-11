import { motion } from 'motion/react';
import { useId } from 'react';
import { cn } from '../../lib/utils';

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string; className?: string }>;
  size?: 'sm' | 'md';
  className?: string;
}

/** Pill toggle with a sliding highlight. */
export function Segmented<T extends string>({ value, onChange, options, size = 'md', className }: SegmentedProps<T>) {
  const id = useId();
  return (
    <div role="radiogroup" className={cn('inline-flex rounded-xl border border-line bg-surface-2 p-1', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative rounded-[9px] font-medium transition-colors',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-[13px]',
              active ? 'text-ink' : 'text-ink-3 hover:text-ink-2',
              active && o.className,
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-[9px] bg-surface shadow-sm ring-1 ring-line"
                transition={{ type: 'spring', stiffness: 500, damping: 36 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
