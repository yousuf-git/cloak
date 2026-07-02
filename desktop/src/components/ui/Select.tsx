import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Fully themed dropdown (not a native <select>) so the popup matches the app's
 * dark/light theme instead of the OS chrome — no white-on-white in dark mode.
 */
export function Select({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled,
  className = '',
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-xs font-medium" style={{ color: 'var(--color-fg-muted)' }}>
          {label}
        </label>
      )}
      <div className="relative" ref={ref}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className="no-drag flex h-9 w-full items-center justify-between gap-2 rounded-lg border px-3 text-sm outline-none transition-colors focus:border-[var(--color-brand-500)] disabled:opacity-50"
          style={{
            backgroundColor: 'var(--color-surface-2)',
            borderColor: open ? 'var(--color-brand-500)' : 'var(--color-border)',
            color: selected ? 'var(--color-fg)' : 'var(--color-fg-muted)',
          }}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronDown
            className="h-4 w-4 shrink-0 transition-transform"
            style={{ color: 'var(--color-fg-muted)', transform: open ? 'rotate(180deg)' : 'none' }}
          />
        </button>

        <AnimatePresence>
          {open && (
            <motion.ul
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              role="listbox"
              className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border p-1 shadow-lg"
              style={{
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                boxShadow: '0 10px 30px -12px rgba(0,0,0,0.45)',
              }}
            >
              {options.map((o) => {
                const active = o.value === value;
                return (
                  <li key={o.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        onChange(o.value);
                        setOpen(false);
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
                      style={{ color: 'var(--color-fg)' }}
                    >
                      <span className="truncate">{o.label}</span>
                      {active && (
                        <Check className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--color-brand-500)' }} />
                      )}
                    </button>
                  </li>
                );
              })}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
