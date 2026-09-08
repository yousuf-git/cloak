import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Copy, Check, Loader2 } from 'lucide-react';

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
    // Start decrypting but do NOT await before touching the clipboard: the
    // engine only honours a write while the click's user activation is still
    // live, and a Tauri round-trip outruns it. That is why the first click used
    // to fail silently and the second — served from the cached plaintext —
    // worked. Handing the pending value to ClipboardItem keeps the write inside
    // the gesture; the awaited paths below are fallbacks for engines without it.
    const pending = resolve();
    const ok = await writeClipboard(pending);
    if (!ok) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="flex items-center gap-2">
      <code
        data-selectable="true"
        title={!revealed && cipher ? 'Encrypted — click the lock to decrypt' : undefined}
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
      <IconButton
        label={revealed ? 'Encrypt' : 'Decrypt'}
        onClick={toggleReveal}
        disabled={busy || animating}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LockKey unlocked={revealed} />}
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

/**
 * Copy a value that is still being decrypted, without losing the click's user
 * activation. Tries the promise-valued ClipboardItem first (the write is queued
 * synchronously inside the gesture), then a plain awaited write, then the
 * legacy execCommand path for engines that refuse both.
 */
async function writeClipboard(pending: Promise<string | null>): Promise<boolean> {
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': pending.then((v) => {
            if (v === null) throw new Error('nothing to copy');
            return new Blob([v], { type: 'text/plain' });
          }),
        }),
      ]);
      return true;
    } catch {
      // Fall through — either the engine rejected the promise form, or the
      // decrypt itself failed (in which case the paths below bail too).
    }
  }

  const value = await pending.catch(() => null);
  if (value === null) return false;

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return legacyCopy(value);
  }
}

/** Last resort: a throwaway textarea plus execCommand, which older WebKit allows. */
function legacyCopy(value: string): boolean {
  try {
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Reveal control: a padlock that a key unlocks. Closed means the value is still
 * ciphertext; the key arriving and the shackle springing open is the decrypt.
 * Locking runs the same beats backwards — shackle shuts, then the key withdraws.
 */
function LockKey({ unlocked }: { unlocked: boolean }) {
  const reduced = useReducedMotion();

  // The two parts are deliberately out of phase: unlocking, the key lands
  // before the shackle gives; locking, the shackle shuts before the key leaves.
  const shackle = reduced
    ? { duration: 0 }
    : { duration: 0.22, ease: 'easeOut' as const, delay: unlocked ? 0.24 : 0 };
  const key = reduced
    ? { duration: 0 }
    : { duration: 0.26, ease: 'easeOut' as const, delay: unlocked ? 0 : 0.2 };

  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/*
        Two drawn shapes cross-faded, rather than one shape rotated: a CSS
        transform on an SVG child depends on transform-box/transform-origin
        support and was not taking effect in the app's webview. Both paths share
        a start point, so swapping them reads as the free end swinging up.
      */}
      <motion.path
        d="M6.5 12V8.5a3.5 3.5 0 0 1 7 0V12"
        animate={{ opacity: unlocked ? 0 : 1 }}
        transition={shackle}
      />
      <motion.path
        d="M6.5 12V8.5a3.5 3.5 0 0 1 6.6-1.4"
        animate={{ opacity: unlocked ? 1 : 0 }}
        transition={shackle}
      />

      <rect x="4" y="12" width="10" height="9" rx="2" />
      <circle cx="9" cy="16.5" r="1.15" />

      <motion.g
        animate={unlocked ? { x: 0, opacity: 1 } : { x: 6, opacity: 0 }}
        transition={key}
      >
        <circle cx="20.2" cy="16.5" r="2.1" />
        <path d="M18.1 16.5H14.4" />
        <path d="M15.9 16.5v2" />
      </motion.g>
    </svg>
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
