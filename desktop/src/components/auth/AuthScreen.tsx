import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Mail, Lock, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/stores/auth';
import { useServers } from '@/stores/server';
import { AuthShell } from './AuthShell';
import { LoginForm } from './LoginForm';
import { SignupForm } from './SignupForm';
import { VerifyEmailForm } from './VerifyEmailForm';
import { TwoFactorForm } from './TwoFactorForm';
import { RecoveryKeyReveal } from './RecoveryKeyReveal';
import { RecoveryEmailForm } from './RecoveryEmailForm';
import { RecoveryCodeForm } from './RecoveryCodeForm';
import { RecoveryResetForm } from './RecoveryResetForm';
import { SandboxButton } from './SandboxButton';
import { ServerBadge } from './ServerBadge';

type Mode = 'login' | 'signup';

export function AuthScreen() {
  const status = useAuth((s) => s.status);
  const info = useServers((s) => s.info);
  // Someone who just claimed a fresh server, or who arrived from an invitation,
  // has no account here yet. Opening on "Welcome back" would ask them to unlock
  // a vault that does not exist.
  const arrivingNew = useAuth((s) => s.claimTicket !== null || s.pendingInviteToken !== null);
  const [mode, setMode] = useState<Mode>(arrivingNew ? 'signup' : 'login');

  return (
    <AuthShell
      eyebrow="Identity gateway"
      status={{ text: 'TLS / active' }}
      headline={
        <>
          <span className="block">Private</span>
          <span className="auth-headline-shift block">by design.</span>
          <span className="block" style={{ color: 'var(--color-text-muted)' }}>
            Sealed in metal.
          </span>
        </>
      }
      blurb="Credentials, keys and environment files are encrypted on this device before they enter your private workspace."
      footer={
        <>
          {status === 'locked' && mode === 'login' && <SandboxButton />}
          {/* Which server this account will live on. On a self-hosted setup
              that is the difference between two identical-looking sign-in
              screens, so it stays visible throughout. */}
          <ServerBadge name={info?.name} />
        </>
      }
    >
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
    </AuthShell>
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
