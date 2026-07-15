import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Fingerprint, Clock, Palette, LogOut, Lock, Loader2, PlayCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { api, getRefreshToken } from '@/lib/api';
import { crypto } from '@/lib/tauri-crypto';
import { useAuth } from '@/stores/auth';
import { useAppMode } from '@/stores/app-mode';
import { useTheme } from '@/hooks/useTheme';

export function SettingsPage() {
  const sandbox = useAppMode((s) => s.sandbox);
  const email = useAuth((s) => s.email);
  const logout = useAuth((s) => s.logout);

  const [twoFactor, setTwoFactor] = useState<boolean | null>(sandbox ? false : null);
  const [twoFactorBusy, setTwoFactorBusy] = useState(false);
  const [remember, setRemember] = useState(false);
  const [rememberBusy, setRememberBusy] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (sandbox) return;
    api
      .me()
      .then((me) => setTwoFactor(me.two_factor_enabled))
      .catch(() => setTwoFactor(false));
    crypto.rememberStatus().then(setRemember).catch(() => setRemember(false));
  }, [sandbox]);

  const toggleTwoFactor = async () => {
    if (sandbox) return setTwoFactor((v) => !v);
    const next = !twoFactor;
    setTwoFactorBusy(true);
    try {
      await api.setTwoFactor(next);
      setTwoFactor(next);
    } finally {
      setTwoFactorBusy(false);
    }
  };

  const toggleRemember = async () => {
    if (sandbox) return setRemember((v) => !v);
    setRememberBusy(true);
    try {
      if (remember) {
        await crypto.rememberClear();
        setRemember(false);
      } else {
        const token = getRefreshToken();
        if (token && email) {
          await crypto.rememberEnable(token, email);
          setRemember(true);
        }
      }
    } finally {
      setRememberBusy(false);
    }
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col">
      <PageHeader title="Settings" description="Manage security, session, and appearance preferences." />

      {sandbox && (
        <div
          className="mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ backgroundColor: 'color-mix(in srgb, var(--color-brand-500) 12%, transparent)', color: 'var(--color-brand-600)' }}
        >
          <PlayCircle className="h-4 w-4" />
          Sandbox mode — settings here are illustrative and aren&apos;t saved.
        </div>
      )}

      <div className="flex flex-col gap-4">
        <Section icon={Lock} title="Security" description="Zero-knowledge encryption status.">
          <Row label="Encryption" hint="XChaCha20-Poly1305 · Argon2id KDF">
            <Badge tone="green">Active</Badge>
          </Row>
          <Row label="Account" hint={email ?? 'Signed in'}>
            <Badge tone="brand">{sandbox ? 'Sandbox' : 'Signed in'}</Badge>
          </Row>
        </Section>

        <Section icon={Fingerprint} title="Two-Factor Authentication" description="Email OTP on new sign-ins.">
          <Row label="Email OTP (2FA)" hint="One-time codes via email">
            {twoFactor === null ? (
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--color-fg-muted)' }} />
            ) : (
              <Toggle on={twoFactor} disabled={twoFactorBusy} onChange={toggleTwoFactor} />
            )}
          </Row>
        </Section>

        <Section icon={Clock} title="Session" description="How long Cloak stays unlocked.">
          <Row label="30-day Remember Me" hint="Vault key stored in the OS secure keychain">
            <Toggle on={remember} disabled={rememberBusy} onChange={toggleRemember} />
          </Row>
          <Row label="Log out now" hint="Clear the in-memory keys immediately">
            <Button size="sm" variant="outline" icon={<LogOut className="h-4 w-4" />} onClick={() => logout()}>
              Log out
            </Button>
          </Row>
        </Section>

        <Section icon={Palette} title="Appearance" description="Theme and display.">
          <Row label="Theme" hint="Matches the desktop window chrome">
            <div className="flex gap-1">
              {(['system', 'light', 'dark'] as const).map((t) => (
                <Button
                  key={t}
                  size="sm"
                  variant={theme === t ? 'outline' : 'ghost'}
                  onClick={() => setTheme(t)}
                  className="capitalize"
                >
                  {t}
                </Button>
              ))}
            </div>
          </Row>
        </Section>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof ShieldCheck;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-xl border"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <div className="flex items-center gap-3 border-b p-4" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--color-surface-2)' }}>
          <Icon className="h-4 w-4" style={{ color: 'var(--color-brand-500)' }} />
        </div>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
            {description}
          </p>
        </div>
      </div>
      <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
        {children}
      </div>
    </motion.section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        {hint && (
          <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
            {hint}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

function Toggle({ on, disabled, onChange }: { on: boolean; disabled?: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      role="switch"
      aria-checked={on}
      className="no-drag relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50"
      style={{ backgroundColor: on ? 'var(--color-brand-600)' : 'var(--color-surface-2)' }}
    >
      <motion.span
        className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm"
        animate={{ left: on ? 22 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </button>
  );
}
