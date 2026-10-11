import * as RadixDialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

function useIsPhone() {
  const query = '(max-width: 639px)';
  const [phone, setPhone] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setPhone(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return phone;
}

/** Centered card on desktop, a bottom sheet you can reach with a thumb on phones. */
export function Dialog({ open, onOpenChange, title, description, icon, children, className }: DialogProps) {
  const phone = useIsPhone();
  const motionProps = phone
    ? { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' }, transition: { type: 'spring', stiffness: 380, damping: 38 } as const }
    : {
        initial: { opacity: 0, y: 18, scale: 0.96 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 10, scale: 0.98 },
        transition: { type: 'spring', stiffness: 420, damping: 32 } as const,
      };

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <RadixDialog.Portal forceMount>
            <RadixDialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[3px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </RadixDialog.Overlay>
            <RadixDialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                {...motionProps}
                className={cn(
                  'card fixed z-50 flex flex-col p-0 outline-none',
                  phone
                    ? 'inset-x-0 bottom-0 max-h-[92dvh] rounded-b-none pb-[env(safe-area-inset-bottom)]'
                    : 'left-1/2 top-[8vh] max-h-[84vh] w-[calc(100vw-32px)] max-w-lg -translate-x-1/2',
                  className,
                )}
              >
                {phone && <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-surface-3" />}
                <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
                  <div className="flex items-center gap-3">
                    {icon && <div className="flex size-10 items-center justify-center rounded-2xl bg-surface-2 text-xl">{icon}</div>}
                    <div>
                      <RadixDialog.Title className="display text-lg font-semibold">{title}</RadixDialog.Title>
                      {description ? (
                        <RadixDialog.Description className="mt-0.5 text-sm text-ink-2">{description}</RadixDialog.Description>
                      ) : (
                        <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
                      )}
                    </div>
                  </div>
                  <RadixDialog.Close className="rounded-xl p-2 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink" aria-label="Close">
                    <X className="size-4" />
                  </RadixDialog.Close>
                </div>
                <div className="overflow-y-auto px-6 pb-6 pt-3">{children}</div>
              </motion.div>
            </RadixDialog.Content>
          </RadixDialog.Portal>
        )}
      </AnimatePresence>
    </RadixDialog.Root>
  );
}
