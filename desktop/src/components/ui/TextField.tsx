import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
  revealToggle?: boolean;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, icon, revealToggle, type = 'text', className, id, ...props },
  ref,
) {
  const [revealed, setRevealed] = useState(false);
  const inputType = revealToggle ? (revealed ? 'text' : 'password') : type;
  const fieldId = id ?? props.name;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={fieldId} className="text-xs font-medium" style={{ color: 'var(--color-fg-muted)' }}>
          {label}
        </label>
      )}
      <div
        className={cn(
          'flex h-10 items-center gap-2 rounded-lg border px-3 transition-colors focus-within:border-[var(--color-brand-500)]',
        )}
        style={{
          backgroundColor: 'var(--color-surface-2)',
          borderColor: error ? '#dc2626' : 'var(--color-border)',
        }}
      >
        {icon && <span style={{ color: 'var(--color-fg-muted)' }}>{icon}</span>}
        <input
          ref={ref}
          id={fieldId}
          type={inputType}
          className={cn('w-full bg-transparent text-sm outline-none placeholder:opacity-50', className)}
          style={{ color: 'var(--color-fg)', colorScheme: 'inherit' }}
          {...props}
        />
        {revealToggle && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setRevealed((v) => !v)}
            className="no-drag shrink-0 opacity-60 transition-opacity hover:opacity-100"
            style={{ color: 'var(--color-fg-muted)' }}
            aria-label={revealed ? 'Hide' : 'Show'}
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error ? (
        <span className="text-xs" style={{ color: '#dc2626' }}>
          {error}
        </span>
      ) : hint ? (
        <span className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
          {hint}
        </span>
      ) : null}
    </div>
  );
});
