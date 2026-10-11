import confetti from 'canvas-confetti';

const COLORS = ['#a3e635', '#2dd4bf', '#38bdf8', '#fbbf24', '#f472b6'];

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A short burst from both sides, for goals reached and badges earned. */
export function celebrate() {
  if (reduced()) return;
  const base = { particleCount: 70, spread: 70, startVelocity: 48, ticks: 220, colors: COLORS, disableForReducedMotion: true };
  confetti({ ...base, angle: 60, origin: { x: 0, y: 0.75 } });
  confetti({ ...base, angle: 120, origin: { x: 1, y: 0.75 } });
}

/** A small pop at an element, e.g. when a ring closes. */
export function sparkAt(el: Element | null) {
  if (!el || reduced()) return;
  const r = el.getBoundingClientRect();
  confetti({
    particleCount: 36,
    spread: 360,
    startVelocity: 18,
    gravity: 0.6,
    ticks: 120,
    scalar: 0.8,
    colors: COLORS,
    origin: { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight },
    disableForReducedMotion: true,
  });
}
