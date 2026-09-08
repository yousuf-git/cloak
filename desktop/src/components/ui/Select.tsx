import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

interface Placement {
  top: number;
  left: number;
  width: number;
  openUp: boolean;
}

const ROW_HEIGHT = 34;
const MAX_POPUP_HEIGHT = 240;
const GAP = 4;

/**
 * Fully themed dropdown (not a native <select>) so the popup matches the app's
 * dark/light theme instead of the OS chrome — no white-on-white in dark mode.
 *
 * The list renders in a portal, positioned fixed against the trigger. An
 * absolutely positioned popup still counts toward an ancestor's scrollable
 * area, so inside a modal body or a scrolling page it would spawn a scrollbar
 * and then get clipped by that same overflow. Escaping to the body avoids both.
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
  const [placement, setPlacement] = useState<Placement | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLUListElement>(null);
  const selected = options.find((o) => o.value === value);

  const place = useCallback(() => {
    const trigger = triggerRef.current?.getBoundingClientRect();
    if (!trigger) return;

    const wanted = Math.min(options.length * ROW_HEIGHT + 8, MAX_POPUP_HEIGHT);
    const below = window.innerHeight - trigger.bottom - GAP;
    // Flip upward only when below genuinely can't hold the list and above is roomier.
    const openUp = below < wanted && trigger.top - GAP > below;

    setPlacement({
      left: trigger.left,
      width: trigger.width,
      top: openUp ? trigger.top - GAP : trigger.bottom + GAP,
      openUp,
    });
  }, [options.length]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      // The popup lives outside the trigger's subtree now, so both must be checked
      // or clicking an option would close the list before the option's click fires.
      if (triggerRef.current?.contains(target) || popupRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const reposition = () => place();

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    // Capture phase: catch scrolling in any ancestor, not just the window.
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, place]);

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-xs font-medium" style={{ color: 'var(--color-fg-muted)' }}>
          {label}
        </label>
      )}
      <div className="relative" ref={triggerRef}>
        <button
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
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
      </div>

      {createPortal(
        <AnimatePresence>
          {open && placement && (
            <motion.ul
              ref={popupRef}
              initial={{ opacity: 0, y: placement.openUp ? 4 : -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: placement.openUp ? 4 : -4 }}
              transition={{ duration: 0.12 }}
              role="listbox"
              className="fixed z-[200] max-h-60 overflow-auto rounded-lg border p-1 shadow-lg"
              style={{
                top: placement.top,
                left: placement.left,
                width: placement.width,
                transform: placement.openUp ? 'translateY(-100%)' : undefined,
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
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
