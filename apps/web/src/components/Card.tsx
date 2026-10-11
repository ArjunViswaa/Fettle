import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

interface CardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  delay?: number;
}

/** Dashboard panel that rises in with a short stagger. */
export function Card({ title, subtitle, action, children, className, bodyClassName, delay = 0 }: CardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
      className={cn('card relative overflow-hidden', className)}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-5">
          <div>
            {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn('p-5', !!title && 'pt-4', bodyClassName)}>{children}</div>
    </motion.section>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-surface-2 text-ink-3">{icon}</div>
      <p className="text-sm font-medium">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-ink-3">{children}</div>}
    </div>
  );
}
