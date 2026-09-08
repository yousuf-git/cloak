import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ShieldCheck, Mail, Lock, KeyRound, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/stores/auth';
import { useScramble } from '@/components/ui/SecretField';
import { LoginForm } from './LoginForm';
import { SignupForm } from './SignupForm';
import { VerifyEmailForm } from './VerifyEmailForm';
import { TwoFactorForm } from './TwoFactorForm';
import { RecoveryKeyReveal } from './RecoveryKeyReveal';
import { RecoveryEmailForm } from './RecoveryEmailForm';
import { RecoveryCodeForm } from './RecoveryCodeForm';
import { RecoveryResetForm } from './RecoveryResetForm';
import { SandboxButton } from './SandboxButton';

type Mode = 'login' | 'signup';

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
      {/* Fixed two-line box: the sentence changes length as it decrypts, and a
          reflowing panel behind the sign-in form is worse than a little slack. */}
      <p className="auth-claim-text" aria-live="polite">
        {text}
      </p>
    </div>
  );
}

export function AuthScreen() {
  const status = useAuth((s) => s.status);
  const [mode, setMode] = useState<Mode>('login');

  return (
    <div className="auth-screen alloy-grid relative flex h-screen w-screen overflow-hidden">
      {/* Draggable region across the whole top edge for frameless feel. */}
      <div className="drag-region absolute inset-x-0 top-0 z-30 h-11" />

      {/* Brand panel */}
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
              <h1 className="auth-headline">
                <span className="block">Private</span>
                <span className="auth-headline-shift block">by design.</span>
                <span className="block" style={{ color: 'var(--color-text-muted)' }}>
                  Sealed in metal.
                </span>
              </h1>

              {/* Runs back under the rail and fades out — a cut across the panel
                  rather than another stacked divider. */}
              <span className="auth-cut" aria-hidden />

              <p className="max-w-[22rem] text-sm leading-6" style={{ color: 'var(--color-text-muted)' }}>
                Credentials, keys and environment files are encrypted on this device before they
                enter your private workspace.
              </p>
            </div>

            <DecryptingClaim />
          </div>
        </div>
      </aside>

      {/* Form panel */}
      <main className="relative flex flex-1 justify-center overflow-y-auto p-5 pt-12 sm:p-8 sm:pt-12">
        <div className="my-auto w-full max-w-[30rem]">
          <div className="mb-4 flex items-center justify-between px-1">
            <span className="telemetry-label">Identity gateway</span>
            <span className="telemetry-label" style={{ color: 'var(--color-accent)' }}>TLS / active</span>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={status === 'locked' ? mode : status}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="auth-card alloy-panel"
            >
              {status === 'show_recovery_key' ? (
                <RecoveryKeyReveal />
              ) : status === 'awaiting_verification' ? (
                <VerifyEmailForm />
              ) : status === 'awaiting_2fa' ? (
                <TwoFactorForm />
              ) : status === 'recovery_email' ? (
                <RecoveryEmailForm />
              ) : status === 'recovery_code' ? (
                <RecoveryCodeForm />
              ) : status === 'recovery_reset' ? (
                <RecoveryResetForm />
              ) : mode === 'login' ? (
                <LoginForm onSwitch={() => setMode('signup')} />
              ) : (
                <SignupForm onSwitch={() => setMode('login')} />
              )}
            </motion.div>
          </AnimatePresence>

          {status === 'locked' && mode === 'login' && <SandboxButton />}
        </div>
      </main>
    </div>
  );
}

export function AuthHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle: string;
  onBack?: () => void;
}) {
  return (
    <div className="mb-5 flex flex-col gap-2">
      {onBack && (
        <button
          onClick={onBack}
          className="no-drag mb-2 inline-flex w-fit items-center gap-2 text-xs transition-transform hover:-translate-x-0.5"
          style={{ color: 'var(--color-fg-muted)' }}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
      )}
      <span className="telemetry-label" style={{ color: 'var(--color-accent)' }}>Secure authentication</span>
      <h2 className="font-display text-2xl font-semibold tracking-[-0.03em]">{title}</h2>
      <p className="max-w-md text-sm leading-6" style={{ color: 'var(--color-fg-muted)' }}>
        {subtitle}
      </p>
    </div>
  );
}

export const fieldIcons = { Mail, Lock };
