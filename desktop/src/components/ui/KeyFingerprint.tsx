import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface KeyFingerprintProps {
  value?: string;
  loading?: boolean;
  label?: string;
  /** Rendered under the digits — say what the reader is meant to do with it. */
  hint?: string;
}

/**
 * A public key's fingerprint, shown identically everywhere it appears so the
 * two people comparing one are looking at the same thing. Ten groups of four
 * hex digits, sized for reading aloud rather than skimming.
 */
export function KeyFingerprint({ value, loading, label, hint }: KeyFingerprintProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  const groups = value?.split('-') ?? [];

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <span
          className="text-[11px] font-medium uppercase tracking-wide"
          style={{ color: 'var(--color-fg-muted)' }}
        >
          {label}
        </span>
      )}
      <div
        className="flex items-start justify-between gap-3 rounded-lg border p-3"
        style={{ backgroundColor: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}
      >
        {loading ? (
          <span className="text-sm" style={{ color: 'var(--color-fg-muted)' }}>
            Computing…
          </span>
        ) : value ? (
          <code
            data-selectable="true"
            className="flex flex-wrap gap-x-2 gap-y-1 text-[13px] font-medium leading-relaxed tracking-wide"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {groups.map((group, i) => (
              <span key={`${group}-${i}`}>{group}</span>
            ))}
          </code>
        ) : (
          <span className="text-sm" style={{ color: 'var(--color-fg-muted)' }}>
            Unavailable
          </span>
        )}

        {value && (
          <button
            type="button"
            onClick={copy}
            className="no-drag shrink-0 rounded-md p-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{ color: copied ? '#16a34a' : 'var(--color-fg-muted)' }}
            aria-label="Copy fingerprint"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
        )}
      </div>
      {hint && (
        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-fg-muted)' }}>
          {hint}
        </p>
      )}
    </div>
  );
}
