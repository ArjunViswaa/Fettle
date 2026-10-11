import { motion } from 'motion/react';
import { toast } from 'sonner';
import { formatWater } from '@fettle/shared';
import { api } from '../lib/api';
import { refreshHealthData, useUnits } from '../lib/queries';
import { Dialog } from './ui/Dialog';
import type { LogTarget } from './UiProvider';
import { useUi } from './UiProvider';

const ITEMS: Array<{ target: LogTarget; emoji: string; label: string; hint: string; color: string }> = [
  { target: { kind: 'food' }, emoji: '🍽️', label: 'Food', hint: 'Meals & snacks', color: 'var(--c-energy)' },
  { target: { kind: 'workout' }, emoji: '🏃', label: 'Workout', hint: 'Any exercise', color: 'var(--c-move)' },
  { target: { kind: 'steps' }, emoji: '👟', label: 'Steps', hint: "Today's total", color: 'var(--c-move)' },
  { target: { kind: 'weight' }, emoji: '⚖️', label: 'Weight', hint: 'Weigh-in', color: 'var(--c-weight)' },
  { target: { kind: 'sleep' }, emoji: '🌙', label: 'Sleep', hint: 'Last night', color: 'var(--c-sleep)' },
  { target: { kind: 'mood' }, emoji: '🙂', label: 'Mood', hint: 'Check in', color: 'var(--c-mind)' },
  { target: { kind: 'vital' }, emoji: '❤️', label: 'Vitals', hint: 'HR, BP, glucose…', color: 'var(--c-heart)' },
  { target: { kind: 'measurement' }, emoji: '📏', label: 'Measurements', hint: 'Waist, hips…', color: 'var(--c-weight)' },
];

export function QuickLogMenu({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; onPick: (t: LogTarget) => void }) {
  const { day } = useUi();
  const units = useUnits();

  const addWater = async (ml: number) => {
    try {
      await api.addWater(day, ml);
      toast.success(`${formatWater(ml, units)} of water added 💧`);
      onOpenChange(false);
      await refreshHealthData();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Log something" description="Tip: press L or Ctrl+K anywhere">
      <div className="mb-4 flex items-center gap-2 rounded-2xl border border-line bg-[color-mix(in_oklab,var(--c-water)_8%,var(--surface))] p-3">
        <span className="text-2xl">💧</span>
        <span className="flex-1 text-sm font-medium">Water</span>
        {[250, 500].map((ml) => (
          <button key={ml} onClick={() => addWater(ml)} className="chip hover:!border-[var(--c-water)]">
            +{formatWater(ml, units)}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {ITEMS.map((item, i) => (
          <motion.button
            key={item.label}
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: i * 0.03, type: 'spring', stiffness: 400, damping: 26 }}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onPick(item.target)}
            className="group flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-surface-2 px-2 py-4 text-center transition-colors hover:border-line-strong"
          >
            <span
              className="flex size-12 items-center justify-center rounded-2xl text-2xl transition-transform group-hover:scale-110"
              style={{ background: `color-mix(in oklab, ${item.color} 16%, transparent)` }}
            >
              {item.emoji}
            </span>
            <span className="text-sm font-medium">{item.label}</span>
            <span className="text-[11px] text-ink-3">{item.hint}</span>
          </motion.button>
        ))}
      </div>
    </Dialog>
  );
}
