import { useEffect, useState, type ReactNode } from 'react';
import { ShieldCheck, Lock, KeyRound } from 'lucide-react';
import { useScramble } from '@/components/ui/SecretField';

/**
 * Rotated through the brand panel one at a time, each arriving as ciphertext
 * that decrypts in place. The claim and the way it is shown are the same idea.
 */
const CLAIMS = [
  {
    icon: Lock,
    label: 'Zero-knowledge',
    text: 'Your master password never leaves this device.',
  },
  {
    icon: KeyRound,
    label: 'XChaCha20-Poly1305',
    text: 'Every field is sealed here, before it reaches the network.',
  },
  {
    icon: ShieldCheck,
    label: 'Email 2FA',
    text: 'A second factor, plus a 30-day trusted-device option.',
  },
];

const CLAIM_HOLD_MS = 2800;

function DecryptingClaim() {
  const [index, setIndex] = useState(0);
  const { text, play } = useScramble();
  const claim = CLAIMS[index]!;

  useEffect(() => {
    let hold: number | undefined;
    play(CLAIMS[index]!.text, 'in', () => {
      hold = window.setTimeout(() => {
        play(CLAIMS[index]!.text, 'out', () => setIndex((i) => (i + 1) % CLAIMS.length));
      }, CLAIM_HOLD_MS);
    });
    return () => window.clearTimeout(hold);
  }, [index, play]);

  const Icon = claim.icon;

  return (
    <div className="auth-claim">
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }} />
          <span className="telemetry-label" style={{ color: 'var(--color-accent)' }}>
            {claim.label}
          </span>
        </span>
        <span className="flex items-center gap-1.5" aria-hidden>
          {CLAIMS.map((c, i) => (
            <span key={c.label} className="auth-claim-tick" data-on={i === index || undefined} />
          ))}
        </span>
      </div>
      <p className="auth-claim-text">{text}</p>
    </div>
  );
}

/**
 * The framed two-panel surface every pre-session screen sits in: choosing a
 * server, claiming a fresh one, and signing in all share it, so the app looks
 * like one product from the first launch rather than three.
 */
export function AuthShell({
  eyebrow,
  status,
  headline,
  blurb,
  children,
  footer,
}: {
  /** Mono label above the card, naming the step. */
  eyebrow: string;
  /** Right-hand mono label. Carries live state, not decoration. */
  status: { text: string; tone?: 'accent' | 'muted' | 'warn' };
  headline: ReactNode;
  blurb: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const statusColor =
    status.tone === 'warn'
      ? 'var(--color-amber-500, #f59e0b)'
      : status.tone === 'muted'
        ? 'var(--color-fg-muted)'
        : 'var(--color-accent)';

  return (
    <div className="auth-screen alloy-grid relative flex h-screen w-screen overflow-hidden">
      {/* Draggable region across the whole top edge for frameless feel. */}
      <div className="drag-region absolute inset-x-0 top-0 z-30 h-11" />

      <aside className="auth-brand-panel relative hidden w-[44%] shrink-0 overflow-hidden lg:flex">
        {/* Turns the composition off a single axis: the protocol mark reads up
            the edge instead of sitting in another flush-left row. */}
        <div className="auth-rail">
          <span className="telemetry-label">Obsidian protocol / 01</span>
          <span className="status-dot h-1.5 w-1.5 shrink-0 rounded-full" />
        </div>

        <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-between py-10 pl-7 pr-9 xl:py-14 xl:pr-12">
          <div className="flex items-center gap-2.5">
            <img src="/cloak-mono.png" alt="" className="h-7 w-7 dark:brightness-0 dark:invert" />
            <span className="font-display text-base font-semibold tracking-tight">Cloak</span>
          </div>

          {/* Headline, rule, blurb and the live claim read as one anchored
              block; the empty field above it is the composition, not a gap. */}
          <div className="flex min-w-0 flex-col gap-9">
            <div className="min-w-0">
              <h1 className="auth-headline">{headline}</h1>

              {/* Runs back under the rail and fades out — a cut across the panel
                  rather than another stacked divider. */}
              <span className="auth-cut" aria-hidden />

              <p className="max-w-[22rem] text-sm leading-6" style={{ color: 'var(--color-text-muted)' }}>
                {blurb}
              </p>
            </div>

            <DecryptingClaim />
          </div>
        </div>
      </aside>

      <main className="relative flex flex-1 justify-center overflow-y-auto p-5 pt-12 sm:p-8 sm:pt-12">
        <div className="my-auto w-full max-w-[30rem]">
          <div className="mb-4 flex items-center justify-between px-1">
            <span className="telemetry-label">{eyebrow}</span>
            <span className="telemetry-label" style={{ color: statusColor }}>
              {status.text}
            </span>
          </div>
          {children}
          {footer}
        </div>
      </main>
    </div>
  );
}
