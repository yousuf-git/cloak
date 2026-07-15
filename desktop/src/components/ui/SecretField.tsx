import { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Copy, Check, Loader2 } from 'lucide-react';

const SCRAMBLE_GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
/** Frames the whole transition spans, so long blobs animate as fast as short ones. */
const SCRAMBLE_FRAMES = 34;

export type ScrambleDirection = 'in' | 'out';

interface ScrambleOpts {
  glyphSource?: string;
  direction?: ScrambleDirection;
  onFrame: (s: string) => void;
  onDone: () => void;
}

/**
 * Animate a "decrypting/encrypting" scramble between ciphertext-like glyphs and
 * the plaintext `target`, resolving left-to-right.
 *  - `in`  → glyphs settle into the plaintext (final frame = target).
 *  - `out` → the plaintext dissolves back into glyphs (final frame = scramble).
 * `glyphSource` (the stored ciphertext) seeds the alphabet so the flicker reads
 * as the real encrypted characters. Returns a cancel function. Honours
 * `prefers-reduced-motion` by jumping straight to the end state.
 */
export function runScramble(target: string, opts: ScrambleOpts): () => void {
  const { glyphSource, direction = 'in', onFrame, onDone } = opts;
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const pool = (glyphSource?.replace(/\s+/g, '') || '') + SCRAMBLE_GLYPHS;
  const glyph = () => pool[Math.floor(Math.random() * pool.length)] ?? '•';
  const keep = (c: string) => c === ' ' || c === '\n' || c === '\t';
  const total = target.length;

  const build = (settled: number): string => {
    let out = '';
    for (let i = 0; i < total; i++) {
      const ch = target[i] ?? '';
      if (keep(ch)) {
        out += ch;
        continue;
      }
      const done = i < settled;
      out += direction === 'in' ? (done ? ch : glyph()) : done ? glyph() : ch;
    }
    return out;
  };

  if (reduced || total === 0) {
    onFrame(direction === 'in' ? target : build(total));
    onDone();
    return () => {};
  }

  onFrame(build(0)); // seed synchronously — no flash of the opposite state
  const step = Math.max(1, Math.ceil(total / SCRAMBLE_FRAMES));
  let settled = 0;
  let raf = 0;
  let cancelled = false;
  const tick = () => {
    if (cancelled) return;
    settled += step;
    if (settled >= total) {
      onFrame(direction === 'in' ? target : build(total));
      onDone();
      return;
    }
    onFrame(build(settled));
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => {
    cancelled = true;
    cancelAnimationFrame(raf);
  };
}

/**
 * Stateful wrapper around {@link runScramble}. `play(target, direction)` starts
 * an animation; render `text` while `animating` is true, then fall back to your
 * own revealed/masked value.
 */
export function useScramble(glyphSource?: string) {
  const [text, setText] = useState('');
  const [animating, setAnimating] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cancelRef.current?.(), []);

  const play = useCallback(
    (target: string, direction: ScrambleDirection, onDone?: () => void) => {
      cancelRef.current?.();
      setAnimating(true);
      cancelRef.current = runScramble(target, {
        glyphSource,
        direction,
        onFrame: setText,
        onDone: () => {
          setAnimating(false);
          onDone?.();
        },
      });
    },
    [glyphSource],
  );

  return { text, animating, play };
}

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

  // Ciphertext↔plaintext scramble on reveal (in) and hide (out).
  const { text: animText, animating, play } = useScramble(cipher ?? value);

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
      // Dissolve plaintext back into ciphertext, then re-mask.
      play(plain ?? '', 'out', () => setRevealed(false));
      return;
    }
    const result = await resolve();
    if (result !== null) {
      setRevealed(true);
      play(result, 'in');
    }
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
            : animating || (revealed && plain !== null)
              ? 'var(--color-fg)'
              : 'var(--color-fg-muted)',
        }}
      >
        {error
          ? 'Unable to decrypt'
          : animating
            ? animText
            : revealed && plain !== null
              ? plain
              : maskedPreview(cipher, maskLength)}
      </code>
      <IconButton label={revealed ? 'Hide' : 'Reveal'} onClick={toggleReveal} disabled={busy || animating}>
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
