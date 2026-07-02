import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ShieldCheck, Mail, Lock, KeyRound, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/stores/auth';
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

const HIGHLIGHTS = [
  { icon: Lock, text: 'Zero-knowledge — your master password never leaves this device.' },
  { icon: KeyRound, text: 'End-to-end encryption with XChaCha20-Poly1305.' },
  { icon: ShieldCheck, text: 'Email 2FA and a 30-day trusted-device option.' },
];

export function AuthScreen() {
  const status = useAuth((s) => s.status);
  const [mode, setMode] = useState<Mode>('login');

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Draggable region across the whole top edge for frameless feel. */}
      <div className="drag-region absolute inset-x-0 top-0 h-11" />

      {/* Brand panel */}
      <aside
        className="relative hidden w-[42%] shrink-0 flex-col justify-between p-10 lg:flex"
        style={{
          background:
            'linear-gradient(160deg, var(--color-brand-700) 0%, var(--color-brand-600) 45%, #312e81 100%)',
        }}
      >
        <div className="flex items-center gap-2 text-white">
          <ShieldCheck className="h-6 w-6" />
          <span className="text-lg font-semibold tracking-tight">Cloak</span>
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-3xl font-semibold leading-tight text-white">
              Your secrets,
              <br />
              sealed on your machine.
            </h1>
            <p className="mt-3 max-w-sm text-sm text-white/70">
              A developer-first vault for credentials, API keys and .env files — encrypted before
              anything ever touches the cloud.
            </p>
          </div>

          <ul className="flex flex-col gap-3">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-white/80">
                <span className="mt-0.5 rounded-md bg-white/15 p-1.5">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="max-w-xs">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-white/50">Encrypted locally. Synced privately. Recoverable only by you.</p>
      </aside>

      {/* Form panel */}
      <main className="relative flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <AnimatePresence mode="wait">
            <motion.div
              key={status === 'locked' ? mode : status}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
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

          {status === 'locked' && <SandboxButton />}
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
    <div className="mb-6 flex flex-col gap-2">
      {onBack && (
        <button
          onClick={onBack}
          className="no-drag mb-1 inline-flex w-fit items-center gap-1 text-xs transition-opacity hover:opacity-70"
          style={{ color: 'var(--color-fg-muted)' }}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
      )}
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="text-sm" style={{ color: 'var(--color-fg-muted)' }}>
        {subtitle}
      </p>
    </div>
  );
}

export const fieldIcons = { Mail, Lock };
