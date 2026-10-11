import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    'brand-gradient text-[var(--brand-ink)] font-semibold shadow-[0_10px_28px_-12px_var(--brand)] hover:brightness-110 active:brightness-95 disabled:opacity-60',
  secondary: 'bg-surface-2 text-ink border border-line hover:bg-surface-3 hover:border-line-strong',
  ghost: 'text-ink-2 hover:text-ink hover:bg-surface-2',
  danger: 'bg-[color-mix(in_oklab,var(--bad)_14%,transparent)] text-bad hover:bg-[color-mix(in_oklab,var(--bad)_22%,transparent)]',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-[10px]',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-[15px] gap-2 rounded-[14px]',
  icon: 'h-9 w-9 rounded-xl justify-center',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center font-medium whitespace-nowrap transition-all duration-150 select-none active:scale-[0.98] disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
});
