import { useState } from 'react';
import { Eye, EyeOff, Copy, Check, Loader2 } from 'lucide-react';

interface SecretFieldProps {
  /** Plaintext value (sandbox / already-decrypted). Ignored when `reveal` is set. */
  value?: string;
  /** Lazy decryptor — called on demand so plaintext is only ever derived when needed. */
  reveal?: () => Promise<string>;
  /** Stored ciphertext, shown truncated while masked to convey on-demand decryption. */
  cipher?: string;
  /** Max characters of ciphertext to preview while masked. */
  maskLength?: number;
}

/**
 * Masked-by-default secret display with per-field reveal + copy actions.
 * When `reveal` is provided, the plaintext is decrypted on demand via the Rust
 * core and cached in local component state only while revealed.
 */
function maskedPreview(cipher: string | undefined, len: number): string {
  if (!cipher) return '•'.repeat(len);
  const compact = cipher.replace(/\s+/g, '');
  return compact.length > len ? `${compact.slice(0, len)}…` : compact;
}

export function SecretField({ value, reveal, cipher, maskLength = 20 }: SecretFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const [plain, setPlain] = useState<string | null>(value ?? null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const resolve = async (): Promise<string | null> => {
    if (plain !== null) return plain;
    if (!reveal) return null;
    setBusy(true);
    setError(false);
    try {
      const result = await reveal();
      setPlain(result);
      return result;
    } catch {
      setError(true);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const toggleReveal = async () => {
    if (revealed) {
      setRevealed(false);
      return;
    }
    const result = await resolve();
    if (result !== null) setRevealed(true);
  };

  const copy = async () => {
    const result = await resolve();
    if (result === null) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="flex items-center gap-2">
      <code
        data-selectable="true"
        title={!revealed && cipher ? 'Encrypted — click reveal to decrypt' : undefined}
        className="min-w-0 flex-1 truncate rounded-md px-2.5 py-1.5 font-mono text-xs"
        style={{
          backgroundColor: 'var(--color-surface-2)',
          color: error
            ? '#dc2626'
            : revealed && plain !== null
              ? 'var(--color-fg)'
              : 'var(--color-fg-muted)',
        }}
      >
        {error
          ? 'Unable to decrypt'
          : revealed && plain !== null
            ? plain
            : maskedPreview(cipher, maskLength)}
      </code>
      <IconButton label={revealed ? 'Hide' : 'Reveal'} onClick={toggleReveal} disabled={busy}>
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : revealed ? (
          <EyeOff className="h-3.5 w-3.5" />
        ) : (
          <Eye className="h-3.5 w-3.5" />
        )}
      </IconButton>
      <IconButton label="Copy" onClick={copy} disabled={busy}>
        {copied ? (
          <Check className="h-3.5 w-3.5" style={{ color: '#22c55e' }} />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </IconButton>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="no-drag flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
      style={{ color: 'var(--color-fg-muted)' }}
    >
      {children}
    </button>
  );
}
