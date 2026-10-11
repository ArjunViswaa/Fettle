import { animate, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';

interface AnimatedNumberProps {
  value: number;
  format: (value: number) => string;
  duration?: number;
  decimals?: number;
  className?: string;
}

/**
 * Counts from the previous value to the new one. Writes straight to the DOM so
 * a long count doesn't re-render React on every frame, and always finishes on
 * the exact value.
 */
export function AnimatedNumber({ value, format, duration = 1.1, decimals = 0, className }: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(0);
  const formatRef = useRef(format);
  formatRef.current = format;
  const inView = useInView(ref, { once: true });
  const reduced = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const show = (v: number) => {
      node.textContent = formatRef.current(v);
    };
    if (reduced || !inView) {
      show(value);
      if (reduced) previous.current = value;
      return;
    }
    const controls = animate(previous.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => show(Number(v.toFixed(decimals))),
      onComplete: () => show(value),
    });
    previous.current = value;
    return () => {
      controls.stop();
      show(value);
    };
  }, [value, inView, reduced, duration, decimals]);

  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  );
}
