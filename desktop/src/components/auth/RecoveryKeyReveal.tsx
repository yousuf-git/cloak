import { useState } from 'react';
import { KeyRound, Copy, Check, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/stores/auth';
import { Button } from '@/components/ui/Button';
import { AuthHeader } from './AuthScreen';

export function RecoveryKeyReveal() {
  const recoveryKey = useAuth((s) => s.recoveryKey);
  const acknowledge = useAuth((s) => s.acknowledgeRecoveryKey);
  const returnToLogin = useAuth((s) => s.returnToLogin);
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const copy = async () => {
    if (!recoveryKey) return;
    try {
      await navigator.clipboard.writeText(recoveryKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-center">
        <span className="rounded-2xl p-3" style={{ backgroundColor: 'var(--color-surface-2)' }}>
          <KeyRound className="h-6 w-6" style={{ color: 'var(--color-brand-500)' }} />
        </span>
      </div>

      <AuthHeader
        title="Save your recovery key"
        subtitle="This is the only way to regain access if you forget your master password. We can't show it again."
        onBack={() => returnToLogin()}
      />

      <div
        className="flex items-center justify-between gap-3 rounded-lg border p-3"
        style={{ backgroundColor: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}
      >
        <code
          data-selectable="true"
          className="text-[13px] font-medium tracking-wide"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {recoveryKey}
        </code>
        <button
          type="button"
          onClick={copy}
          className="no-drag shrink-0 rounded-md p-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          style={{ color: copied ? '#16a34a' : 'var(--color-fg-muted)' }}
          aria-label="Copy recovery key"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>

      <div
        className="flex items-start gap-2 rounded-lg px-3 py-2 text-[11px]"
        style={{ backgroundColor: 'color-mix(in srgb, #d97706 12%, transparent)', color: '#b45309' }}
      >
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Store it in a password manager or print it. Anyone with this key and access to your email
          can reset your vault — treat it like a spare key to your home.
        </span>
      </div>

      <label className="flex cursor-pointer items-start gap-2 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="no-drag mt-0.5"
        />
        <span>I&apos;ve saved my recovery key somewhere safe.</span>
      </label>

      <Button onClick={acknowledge} disabled={!confirmed} className="h-10 w-full">
        Continue
      </Button>
    </div>
  );
}
