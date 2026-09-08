import { forwardRef, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useScramble } from './SecretField';

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
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Same decode/encode transition the vault uses when a secret is unmasked, so
  // revealing a password reads as decryption rather than a plain type swap.
  const { text: animText, animating, play } = useScramble();
  const inputType = revealToggle ? (revealed ? 'text' : 'password') : type;
  const fieldId = id ?? props.name;

  const toggleReveal = () => {
    const current = inputRef.current?.value ?? '';
    if (revealed) {
      play(current, 'out', () => setRevealed(false));
      return;
    }
    setRevealed(true);
    play(current, 'in');
  };

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={fieldId} className="telemetry-label">
          {label}
        </label>
      )}
      <div
        className={cn('alloy-field flex h-11 items-center gap-2 rounded-[var(--radius-md)] px-3')}
        style={{
          borderColor: error ? 'var(--color-danger)' : undefined,
        }}
      >
        {icon && <span style={{ color: 'var(--color-fg-muted)' }}>{icon}</span>}
        <div className="relative min-w-0 flex-1">
          <input
            ref={(node) => {
              inputRef.current = node;
              if (typeof ref === 'function') ref(node);
              else if (ref) ref.current = node;
            }}
            id={fieldId}
            type={animating ? 'text' : inputType}
            className={cn('w-full bg-transparent text-sm outline-none placeholder:opacity-50', className)}
            style={{
              // The scramble frames render in the overlay below; the real value
              // stays in the input (and selectable) but goes invisible so the
              // two never show at once.
              color: animating ? 'transparent' : 'var(--color-fg)',
              caretColor: 'var(--color-fg)',
              colorScheme: 'inherit',
            }}
            {...props}
          />
          {animating && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre text-sm"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-fg)' }}
            >
              {animText}
            </span>
          )}
        </div>
        {revealToggle && (
          <button
            type="button"
            tabIndex={-1}
            onClick={toggleReveal}
            className="no-drag shrink-0 opacity-60 transition-opacity hover:opacity-100"
            style={{ color: 'var(--color-fg-muted)' }}
            aria-label={revealed ? 'Hide' : 'Show'}
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error ? (
        <span className="text-xs" style={{ color: 'var(--color-danger)' }}>
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
