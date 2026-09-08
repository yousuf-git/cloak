import { useState } from 'react';
import { KeyRound, Copy, Check, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/stores/auth';
import { Button } from '@/components/ui/Button';
import { AuthHeader } from './AuthScreen';

/** One key opens the account; the other opens its organization. Both are shown once. */
function KeyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-fg-muted)' }}>
        {label}
      </span>
      <div className="alloy-field flex items-center justify-between gap-3 rounded-[var(--radius-md)] p-3">
        <code
          data-selectable="true"
          className="text-[13px] font-medium tracking-wide"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {value}
        </code>
        <button
          type="button"
          onClick={copy}
          className="no-drag shrink-0 rounded-md p-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          style={{ color: copied ? 'var(--color-success)' : 'var(--color-fg-muted)' }}
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export function RecoveryKeyReveal() {
  const recoveryKey = useAuth((s) => s.recoveryKey);
  const orgRecoveryKey = useAuth((s) => s.orgRecoveryKey);
  const acknowledge = useAuth((s) => s.acknowledgeRecoveryKey);
  const returnToLogin = useAuth((s) => s.returnToLogin);
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-center">
        <span className="auth-icon rounded-xl p-3">
          <KeyRound className="h-6 w-6" style={{ color: 'var(--color-accent)' }} />
        </span>
      </div>

      <AuthHeader
        title="Save your recovery keys"
        subtitle="These are the only way to regain access if you forget your master password or lose every device. We can't show them again."
        onBack={() => returnToLogin()}
      />

      <div className="flex flex-col gap-3">
        {recoveryKey && <KeyRow label="Account recovery key" value={recoveryKey} />}
        {orgRecoveryKey && <KeyRow label="Organization recovery key" value={orgRecoveryKey} />}
      </div>

      <div
        className="flex items-start gap-2 rounded-lg px-3 py-2 text-[11px]"
        style={{ backgroundColor: 'color-mix(in srgb, var(--color-warning) 12%, transparent)', color: 'var(--color-warning)' }}
      >
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Store them in a password manager or print them. Anyone with the account key and access to
          your email can reset your vault; the organization key alone reopens its shared secrets.
        </span>
      </div>

      <label className="flex cursor-pointer items-start gap-2 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="no-drag mt-0.5"
        />
        <span>I&apos;ve saved both keys somewhere safe.</span>
      </label>

      <Button onClick={acknowledge} disabled={!confirmed} className="h-10 w-full">
        Continue
      </Button>
    </div>
  );
}
