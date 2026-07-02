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
    'no-drag inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2';
  const sizes: Record<Size, string> = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-9 px-4 text-sm',
  };
  const variants: Record<Variant, string> = {
    primary: 'text-white hover:brightness-110',
    ghost: 'hover:bg-black/5 dark:hover:bg-white/5',
    outline: 'border hover:bg-black/5 dark:hover:bg-white/5',
    danger: 'text-white hover:brightness-110',
  };
  const styleByVariant: Record<Variant, React.CSSProperties> = {
    primary: { backgroundColor: 'var(--color-brand-600)' },
    ghost: { color: 'var(--color-fg-muted)' },
    outline: { borderColor: 'var(--color-border)', color: 'var(--color-fg)' },
    danger: { backgroundColor: '#dc2626' },
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
