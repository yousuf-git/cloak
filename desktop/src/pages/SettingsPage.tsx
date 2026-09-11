import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck,
  Palette,
  LogOut,
  Loader2,
  PlayCircle,
  KeyRound,
  UserRound,
  MonitorSmartphone,
  History,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { TextField } from '@/components/ui/TextField';
import { KeyFingerprint } from '@/components/ui/KeyFingerprint';
import { api, getRefreshToken, type AuditEntryDto, type SessionDto } from '@/lib/api';
import { crypto } from '@/lib/tauri-crypto';
import { useAuth } from '@/stores/auth';
import { useAppMode } from '@/stores/app-mode';
import { useTheme } from '@/hooks/useTheme';
import { useMyFingerprint } from '@/hooks/team';
import { timeAgo, formatUtc } from '@/lib/utils';
import { toast } from '@/stores/toast';

export function SettingsPage() {
  const sandbox = useAppMode((s) => s.sandbox);
  const email = useAuth((s) => s.email);
  const name = useAuth((s) => s.name);
  const setName = useAuth((s) => s.setName);
  const logout = useAuth((s) => s.logout);

  const [twoFactor, setTwoFactor] = useState<boolean | null>(sandbox ? false : null);
  const [twoFactorBusy, setTwoFactorBusy] = useState(false);
  const [remember, setRemember] = useState(false);
  const [rememberBusy, setRememberBusy] = useState(false);
  const { theme, setTheme } = useTheme();
  const { data: myFingerprint, isLoading: fingerprintLoading } = useMyFingerprint();

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
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col">
      <PageHeader title="Settings" description="Manage security, session, and appearance preferences." />

      {sandbox && (
        <div
          className="mb-4 flex items-center gap-2 rounded-[var(--radius-lg)] border px-4 py-3 text-xs"
          style={{
            backgroundColor: 'var(--color-accent-soft)',
            borderColor: 'color-mix(in srgb, var(--color-accent) 24%, var(--color-border-soft))',
            color: 'var(--color-accent)',
          }}
        >
          <PlayCircle className="h-4 w-4" />
          Sandbox mode — settings here are illustrative and aren&apos;t saved.
        </div>
      )}

      {/* Two explicit columns, not grid auto-flow: the cards differ in height, so
          letting the grid place them itself is what left the ragged gaps. The
          split is chosen to make the two columns land at roughly equal height. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Section icon={UserRound} title="Profile" description="How you appear to your team." delay={0}>
            <NameRow name={name} disabled={sandbox} onSave={setName} />
            <Row label="Email" value={email ?? 'Signed in'}>
              <Badge tone="brand">{sandbox ? 'Sandbox' : 'Signed in'}</Badge>
            </Row>
          </Section>

          <Section icon={Palette} title="Appearance" description="Theme and display." delay={0.08}>
            <Row label="Theme" hint="Matches the desktop window chrome">
              <div className="flex flex-wrap gap-1">
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

        <Section
          icon={ShieldCheck}
          title="Security & session"
          description="Encryption, sign-in, and how long Cloak stays unlocked."
          delay={0.04}
        >
          <Row label="Encryption" hint="XChaCha20-Poly1305 · Argon2id KDF">
            <Badge tone="green">Active</Badge>
          </Row>
          <Row label="Email OTP (2FA)" hint="One-time codes on new sign-ins">
            {twoFactor === null ? (
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--color-fg-muted)' }} />
            ) : (
              <Toggle on={twoFactor} disabled={twoFactorBusy} onChange={toggleTwoFactor} />
            )}
          </Row>
          <Row label="30-day Remember Me" hint="Vault key stored in the OS secure keychain">
            <Toggle on={remember} disabled={rememberBusy} onChange={toggleRemember} />
          </Row>
          <Row label="Log out now" hint="Clear the in-memory keys immediately">
            <Button size="sm" variant="outline" icon={<LogOut className="h-4 w-4" />} onClick={() => logout()}>
              Log out
            </Button>
          </Row>
        </Section>
      </div>

      {!sandbox && <SessionsSection />}

      {!sandbox && <SecurityLogSection />}

      {!sandbox && (
        <Section
          icon={KeyRound}
          title="Your key fingerprint"
          description="Verify your device identity before teammates grant access."
          className="mt-4"
          delay={0.16}
        >
          <div className="p-4">
            <KeyFingerprint
              value={myFingerprint}
              loading={fingerprintLoading}
              hint="Read these digits back over a call or in person — never over email or chat. If they differ, do not grant access."
            />
          </div>
        </Section>
      )}
    </div>
  );
}

/**
 * Where this account is signed in.
 *
 * One row per live refresh-token session, so a revoke here ends that device's
 * ability to renew — the access token it already holds keeps working for the
 * few minutes until it expires.
 */
function SessionsSection() {
  const qc = useQueryClient();
  const logout = useAuth((s) => s.logout);
  const [busy, setBusy] = useState<string | null>(null);

  const query = useQuery({ queryKey: ['sessions'], queryFn: () => api.listSessions() });
  const sessions = query.data?.sessions ?? [];

  const revoke = async (session: SessionDto) => {
    setBusy(session.id);
    try {
      const result = await api.revokeSession(session.id);
      if (result.was_current) {
        await logout();
        return;
      }
      await qc.invalidateQueries({ queryKey: ['sessions'] });
      toast.success('Device signed out');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not sign that device out');
    } finally {
      setBusy(null);
    }
  };

  const revokeOthers = async () => {
    setBusy('others');
    try {
      const result = await api.revokeOtherSessions();
      await qc.invalidateQueries({ queryKey: ['sessions'] });
      toast.success(
        result.sessions_ended === 0
          ? 'No other devices were signed in'
          : `Signed out ${result.sessions_ended} other device${result.sessions_ended === 1 ? '' : 's'}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not sign the other devices out');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Section
      icon={MonitorSmartphone}
      title="Where you're signed in"
      description="Every device holding a live session. Sign one out to cut it off now."
      className="mt-4"
      delay={0.12}
    >
      {query.isLoading ? (
        <div className="flex items-center gap-2 p-4 text-sm" style={{ color: 'var(--color-fg-muted)' }}>
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading sessions…
        </div>
      ) : sessions.length === 0 ? (
        <p className="p-4 text-sm" style={{ color: 'var(--color-fg-muted)' }}>
          No live sessions. Signing in again will start one.
        </p>
      ) : (
        sessions.map((session) => (
          <div
            key={session.id}
            className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center sm:gap-4"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium">{describeDevice(session.user_agent)}</p>
                {session.current && <Badge tone="green">This device</Badge>}
              </div>
              <p className="mt-1 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                {session.ip ?? 'Unknown address'} · last used {timeAgo(session.last_used_at)} · signed
                in {formatUtc(session.started_at)}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={busy !== null}
              onClick={() => revoke(session)}
            >
              {busy === session.id ? 'Signing out…' : session.current ? 'Sign out' : 'Revoke'}
            </Button>
          </div>
        ))
      )}

      <Row label="Sign out everywhere else" hint="Ends every session except this one">
        <Button
          size="sm"
          variant="outline"
          icon={<LogOut className="h-4 w-4" />}
          disabled={busy !== null || sessions.length < 2}
          onClick={revokeOthers}
        >
          {busy === 'others' ? 'Signing out…' : 'Sign out others'}
        </Button>
      </Row>
    </Section>
  );
}

/**
 * The account's own security history.
 *
 * The org audit log cannot show this: a sign-in belongs to an account, not an
 * organization, and a refused one has no organization to file it under.
 */
function SecurityLogSection() {
  const query = useQuery({ queryKey: ['security-log'], queryFn: () => api.securityLog() });
  const entries = query.data?.entries ?? [];

  return (
    <Section
      icon={History}
      title="Recent account activity"
      description="Sign-ins, sign-outs and security changes on this account."
      className="mt-4"
      delay={0.14}
    >
      {query.isLoading ? (
        <div className="flex items-center gap-2 p-4 text-sm" style={{ color: 'var(--color-fg-muted)' }}>
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading activity…
        </div>
      ) : entries.length === 0 ? (
        <p className="p-4 text-sm" style={{ color: 'var(--color-fg-muted)' }}>
          Nothing recorded yet.
        </p>
      ) : (
        entries.map((entry) => (
          <div key={entry.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm">{describeEvent(entry)}</span>
              {entry.outcome === 'failure' && <Badge tone="red">failed</Badge>}
            </div>
            <span
              className="shrink-0 text-xs tabular-nums"
              style={{ color: 'var(--color-fg-muted)' }}
              title={formatUtc(entry.created_at)}
            >
              {entry.ip ?? 'unknown address'} · {timeAgo(entry.created_at)}
            </span>
          </div>
        ))
      )}
    </Section>
  );
}

const EVENT_LABELS: Record<string, string> = {
  'auth:signup': 'Account created',
  'auth:login': 'Signed in',
  'auth:login:2fa_challenge': 'Two-factor code sent',
  'auth:2fa': 'Two-factor code accepted',
  'auth:2fa_enabled': 'Two-factor sign-in turned on',
  'auth:2fa_disabled': 'Two-factor sign-in turned off',
  'auth:verify_email': 'Email address verified',
  'auth:logout': 'Signed out',
  'auth:session_revoke': 'A device was signed out',
  'auth:session_revoke_all': 'Signed out every other device',
  'auth:refresh_reuse': 'A spent session token was replayed — session ended',
  'auth:recovery:start': 'Recovery started',
  'auth:recovery:verify': 'Recovery code checked',
  'auth:recovery:reset': 'Master password reset with the recovery key',
  'user:rename': 'Name changed',
};

function describeEvent(entry: AuditEntryDto): string {
  const label = EVENT_LABELS[entry.action] ?? entry.action;
  if (entry.outcome !== 'failure') return label;
  return entry.action === 'auth:login' ? 'Sign-in refused' : `${label} — refused`;
}

/** A name for a session's device, read off the User-Agent it signed in with. */
function describeDevice(userAgent?: string): string {
  if (!userAgent) return 'Unknown device';

  const client = /Cloak/i.test(userAgent)
    ? 'Cloak desktop'
    : /Firefox/i.test(userAgent)
      ? 'Firefox'
      : /Edg\//i.test(userAgent)
        ? 'Edge'
        : /Chrome/i.test(userAgent)
          ? 'Chrome'
          : /Safari/i.test(userAgent)
            ? 'Safari'
            : 'Unknown client';

  const os = /Windows/i.test(userAgent)
    ? 'Windows'
    : /Mac OS X|Macintosh/i.test(userAgent)
      ? 'macOS'
      : /Android/i.test(userAgent)
        ? 'Android'
        : /iPhone|iPad/i.test(userAgent)
          ? 'iOS'
          : /Linux/i.test(userAgent)
            ? 'Linux'
            : null;

  return os ? `${client} on ${os}` : client;
}

/** Inline rename. The name is metadata only — no key material depends on it. */
function NameRow({
  name,
  disabled,
  onSave,
}: {
  name: string | null;
  disabled: boolean;
  onSave: (next: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(name ?? '');
  }, [name, editing]);

  const save = async () => {
    const next = draft.trim();
    if (!next || next === name) return setEditing(false);
    setBusy(true);
    try {
      await onSave(next);
      setEditing(false);
      toast.success('Name updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update your name');
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <Row
        label="Name"
        value={name ?? <span style={{ color: 'var(--color-fg-muted)' }}>Not set</span>}
      >
        <Button size="sm" variant="outline" disabled={disabled} onClick={() => setEditing(true)}>
          {name ? 'Edit' : 'Add name'}
        </Button>
      </Row>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1">
        <TextField
          label="Name"
          autoFocus
          value={draft}
          maxLength={80}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save();
            if (e.key === 'Escape') setEditing(false);
          }}
        />
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
        <Button size="sm" disabled={busy || draft.trim().length === 0} onClick={save}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  children,
  className = '',
  delay = 0,
}: {
  icon: typeof ShieldCheck;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`dashboard-card relative overflow-hidden rounded-[var(--radius-xl)] ${className}`}
    >
      <div className="relative z-10 flex items-center gap-3 border-b p-4" style={{ borderColor: 'var(--color-border-soft)' }}>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border"
          style={{ backgroundColor: 'var(--color-surface-2)', borderColor: 'var(--color-border-soft)' }}
        >
          <Icon className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
        </div>
        <div>
          <p className="font-display text-sm font-semibold">{title}</p>
          <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
            {description}
          </p>
        </div>
      </div>
      <div className="relative z-10 flex flex-col divide-y" style={{ borderColor: 'var(--color-border-soft)' }}>
        {children}
      </div>
    </motion.section>
  );
}

function Row({
  label,
  hint,
  value,
  children,
}: {
  label: string;
  hint?: string;
  /** Identity rows invert the emphasis: the value leads, the field name recedes. */
  value?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0">
        {value !== undefined ? (
          <>
            <p className="telemetry-label">{label}</p>
            <p className="mt-1 truncate text-sm font-medium">{value}</p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium">{label}</p>
            {hint && (
              <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                {hint}
              </p>
            )}
          </>
        )}
      </div>
      <div className="shrink-0">{children}</div>
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
      style={{ backgroundColor: on ? 'var(--color-accent)' : 'var(--color-surface-3)' }}
    >
      <motion.span
        className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm"
        animate={{ left: on ? 22 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </button>
  );
}
