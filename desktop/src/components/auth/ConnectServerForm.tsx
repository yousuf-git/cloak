import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Database,
  Loader2,
  Mail,
  Server,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useServers, LOCAL_SERVER_URL } from '@/stores/server';
import {
  decodeJoinKey,
  isInsecureUrl,
  normalizeServerUrl,
  probeServer,
  type ServerInfo,
} from '@/lib/server';

type Stage =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'failed'; title: string; detail: string }
  | { kind: 'insecure'; url: string; host: string }
  | { kind: 'found'; url: string; info: ServerInfo };

/**
 * Chooses the backend before anything else happens.
 *
 * Cloak has no central service: every team runs its own server, so the first
 * question is which one. The field takes either an address or the join key from
 * an invitation, because the person being invited has the key and has never
 * seen the address.
 */
export function ConnectServerForm({
  onConnected,
}: {
  onConnected: (info: ServerInfo, joinToken: string | null) => void;
}) {
  const servers = useServers((s) => s.servers);
  const localAvailable = useServers((s) => s.localAvailable);
  const connect = useServers((s) => s.connect);
  const activate = useServers((s) => s.activate);
  const forget = useServers((s) => s.forget);

  const [input, setInput] = useState('');
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });
  // Carried from a pasted join key through the probe, so the invitation can be
  // redeemed once there is an account to redeem it with.
  const [joinToken, setJoinToken] = useState<string | null>(null);

  const check = async (rawUrl: string, token: string | null, allowInsecure = false) => {
    const normalized = normalizeServerUrl(rawUrl);
    if (!normalized) {
      setStage({
        kind: 'failed',
        title: 'That does not look like an address',
        detail: 'Enter something like vault.your-company.com, or paste the join key from your invitation email.',
      });
      return;
    }

    if (!allowInsecure && isInsecureUrl(normalized.url)) {
      setStage({ kind: 'insecure', url: normalized.url, host: new URL(normalized.url).host });
      return;
    }

    setStage({ kind: 'checking' });
    setJoinToken(token);
    const result = await probeServer(normalized.url);
    if (!result.ok) {
      setStage({ kind: 'failed', title: result.title, detail: result.detail });
      return;
    }
    setStage({ kind: 'found', url: normalized.url, info: result.info });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const key = decodeJoinKey(input);
    void check(key ? key.url : input, key ? key.token : null);
  };

  const proceed = async () => {
    if (stage.kind !== 'found') return;
    await connect(stage.url, stage.info.name);
    onConnected(stage.info, joinToken);
  };

  return (
    <div className="auth-card alloy-panel">
      <div className="mb-5 flex flex-col gap-2">
        <span className="telemetry-label" style={{ color: 'var(--color-accent)' }}>
          Step one
        </span>
        <h2 className="font-display text-2xl font-semibold tracking-[-0.03em]">
          Connect to your server
        </h2>
        <p className="max-w-md text-sm leading-6" style={{ color: 'var(--color-fg-muted)' }}>
          Cloak runs on hardware your team controls. Enter its address, or paste the join key from
          your invitation and we will find it for you.
        </p>
      </div>

      {servers.length > 0 && (
        <div className="mb-5 flex flex-col gap-2">
          <span className="telemetry-label">Saved</span>
          {servers.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <button
                onClick={() => void activate(s.id).then(() => void check(s.url, null, true))}
                className="no-drag flex min-w-0 flex-1 items-center gap-2.5 rounded-[var(--radius-md)] border px-3 py-2 text-left"
                style={{
                  borderColor: 'var(--color-border-soft)',
                  backgroundColor: 'var(--color-surface-2)',
                }}
              >
                <Server className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--color-accent)' }} />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium">{s.name}</span>
                  <span
                    className="block truncate text-[11px]"
                    style={{ color: 'var(--color-fg-muted)', fontFamily: 'var(--font-mono)' }}
                  >
                    {s.url.replace(/^https?:\/\//, '').replace(/\/api\/v1$/, '')}
                  </span>
                </span>
              </button>
              <button
                onClick={() => void forget(s.id)}
                title={`Forget ${s.name}`}
                className="no-drag shrink-0 rounded-[var(--radius-md)] border p-2"
                style={{ borderColor: 'var(--color-border-soft)', color: 'var(--color-fg-muted)' }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="flex flex-col gap-3">
        <TextField
          label="Server address or join key"
          placeholder="vault.your-company.com"
          autoFocus
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (stage.kind !== 'idle') setStage({ kind: 'idle' });
          }}
          icon={<Server className="h-4 w-4" />}
        />

        {stage.kind !== 'found' && (
          <Button
            type="submit"
            disabled={stage.kind === 'checking' || input.trim().length === 0}
            icon={
              stage.kind === 'checking' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )
            }
          >
            {stage.kind === 'checking' ? 'Checking…' : 'Continue'}
          </Button>
        )}
      </form>

      {stage.kind === 'failed' && <Problem title={stage.title} detail={stage.detail} />}

      {stage.kind === 'insecure' && (
        <Problem
          tone="warn"
          title="That address is not encrypted"
          detail={`Traffic to ${stage.host} would cross the network in the clear. Your vault contents are encrypted on this device either way, but your session token would not be. Only continue if you trust every network between here and there.`}
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => void check(stage.url, joinToken, true)}
            >
              Continue anyway
            </Button>
          }
        />
      )}

      {stage.kind === 'found' && <Found info={stage.info} onProceed={() => void proceed()} />}

      {localAvailable && servers.length === 0 && stage.kind === 'idle' && (
        <button
          onClick={() => void check(LOCAL_SERVER_URL, null, true)}
          className="no-drag mt-4 w-full text-center text-xs underline-offset-4 hover:underline"
          style={{ color: 'var(--color-fg-muted)' }}
        >
          Use the backend running on this machine
        </button>
      )}
    </div>
  );
}

function Found({ info, onProceed }: { info: ServerInfo; onProceed: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mt-4 rounded-[var(--radius-lg)] border p-4"
      style={{
        borderColor: 'color-mix(in srgb, var(--color-accent) 26%, var(--color-border-soft))',
        backgroundColor: 'var(--color-accent-soft)',
      }}
    >
      <div className="flex items-center gap-2.5">
        <Check className="h-4 w-4 shrink-0" style={{ color: 'var(--color-accent)' }} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{info.name}</p>
          <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
            Cloak {info.server_version}
            {info.ownership_claimed ? '' : ' · no owner yet'}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        <Check2 ok label="Database" note="connected" icon={Database} />
        <Check2
          ok={info.checks.email}
          label="Email"
          icon={Mail}
          note={
            info.checks.email
              ? 'codes and invitations will be delivered'
              : 'not configured — codes appear in the server log instead'
          }
        />
      </div>

      <Button className="mt-4 w-full" onClick={onProceed} icon={<ArrowRight className="h-4 w-4" />}>
        {info.ownership_claimed ? 'Continue' : 'Set up this server'}
      </Button>
    </motion.div>
  );
}

function Check2({
  ok,
  label,
  note,
  icon: Icon,
}: {
  ok: boolean;
  label: string;
  note: string;
  icon: typeof Database;
}) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <Icon
        className="mt-0.5 h-3.5 w-3.5 shrink-0"
        style={{ color: ok ? 'var(--color-accent)' : 'var(--color-fg-muted)' }}
      />
      <span style={{ color: 'var(--color-fg-muted)' }}>
        <span style={{ color: 'var(--color-fg)' }}>{label}</span> — {note}
      </span>
    </div>
  );
}

function Problem({
  title,
  detail,
  tone = 'error',
  action,
}: {
  title: string;
  detail: string;
  tone?: 'error' | 'warn';
  action?: React.ReactNode;
}) {
  const color = tone === 'warn' ? 'var(--color-amber-500, #f59e0b)' : 'var(--color-danger, #ef4444)';
  const Icon = tone === 'warn' ? ShieldAlert : AlertTriangle;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mt-4 rounded-[var(--radius-lg)] border p-4"
      style={{
        borderColor: `color-mix(in srgb, ${color} 30%, var(--color-border-soft))`,
        backgroundColor: `color-mix(in srgb, ${color} 8%, transparent)`,
      }}
    >
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color }} />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-fg-muted)' }}>
            {detail}
          </p>
          {action && <div className="mt-3">{action}</div>}
        </div>
      </div>
    </motion.div>
  );
}
