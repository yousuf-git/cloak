import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'ghost' | 'outline' | 'danger';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  className,
  children,
  ...props
}: ButtonProps) {
  const base =
    'alloy-button no-drag inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-semibold tracking-[-0.01em] disabled:cursor-not-allowed disabled:opacity-50';
  const sizes: Record<Size, string> = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-9 px-4 text-sm',
  };
  const variants: Record<Variant, string> = {
    primary: 'alloy-button-primary text-white',
    ghost: 'hover:bg-black/5 dark:hover:bg-white/5',
    outline: 'alloy-button-outline',
    danger: 'alloy-button-danger text-white',
  };
  const styleByVariant: Record<Variant, React.CSSProperties> = {
    primary: {},
    ghost: { color: 'var(--color-fg-muted)' },
    outline: { color: 'var(--color-fg)' },
    danger: {},
  };

  return (
    <button
      className={cn(base, sizes[size], variants[variant], className)}
      style={styleByVariant[variant]}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
