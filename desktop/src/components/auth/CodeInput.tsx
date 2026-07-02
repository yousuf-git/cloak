import { useRef, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

const LENGTH = 6;

/** Segmented 6-digit OTP input with paste + arrow-key support. */
export function CodeInput({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(LENGTH, ' ').slice(0, LENGTH).split('');

  const focus = (i: number) => refs.current[i]?.focus();

  const setDigit = (i: number, d: string) => {
    const arr = value.padEnd(LENGTH, ' ').slice(0, LENGTH).split('');
    arr[i] = d || ' ';
    onChange(arr.join('').replace(/\s/g, ''));
  };

  const handleChange = (i: number, e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) return;
    if (raw.length > 1) {
      // Handle multi-char (autofill) by distributing across cells.
      const next = (value.slice(0, i) + raw).replace(/\D/g, '').slice(0, LENGTH);
      onChange(next);
      focus(Math.min(next.length, LENGTH - 1));
      return;
    }
    setDigit(i, raw);
    if (i < LENGTH - 1) focus(i + 1);
  };

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[i]?.trim()) {
        setDigit(i, '');
      } else if (i > 0) {
        setDigit(i - 1, '');
        focus(i - 1);
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      focus(i - 1);
    } else if (e.key === 'ArrowRight' && i < LENGTH - 1) {
      focus(i + 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH);
    if (pasted) {
      onChange(pasted);
      focus(Math.min(pasted.length, LENGTH - 1));
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-center gap-2">
        {Array.from({ length: LENGTH }).map((_, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            inputMode="numeric"
            maxLength={1}
            autoFocus={i === 0}
            value={digits[i]?.trim() ?? ''}
            onChange={(e) => handleChange(i, e)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            className={cn(
              'no-drag h-12 w-11 rounded-lg border text-center text-lg font-semibold outline-none transition-colors focus:border-[var(--color-brand-500)]',
            )}
            style={{
              backgroundColor: 'var(--color-surface-2)',
              borderColor: error ? '#dc2626' : 'var(--color-border)',
            }}
          />
        ))}
      </div>
      {error && (
        <span className="text-center text-xs" style={{ color: '#dc2626' }}>
          {error}
        </span>
      )}
    </div>
  );
}
