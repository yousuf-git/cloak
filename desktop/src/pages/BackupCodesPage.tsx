import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, LifeBuoy, Check, RotateCcw, Eye, EyeOff, Copy, Loader2, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState, NoResults } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { TextField } from '@/components/ui/TextField';
import { useScramble } from '@/components/ui/SecretField';
import { usePlatforms } from '@/hooks/vault';
import { useVaultCrypto } from '@/hooks/useVaultCrypto';
import { useSearch, matchesQuery } from '@/stores/search';
import type { PlatformDto, BackupCodeDto } from '@/lib/api';
import { cn } from '@/lib/utils';

export function BackupCodesPage() {
  const platforms = usePlatforms();
  const { encrypt } = useVaultCrypto();
  const query = useSearch((s) => s.query);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<PlatformDto | null>(null);
  const [addingTo, setAddingTo] = useState<PlatformDto | null>(null);

  const filtered = platforms.items.filter((p) => matchesQuery(query, p.name, p.note));

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Backup Codes"
        description="2FA recovery codes per platform — encrypted and hidden until you reveal them."
        actions={
          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
            New Platform
          </Button>
        }
      />

      {platforms.isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--color-fg-muted)' }} />
        </div>
      ) : platforms.items.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title="No platforms yet"
          description="Add a platform (like GitHub or Google) and store its 2FA backup codes securely."
          action={
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
              Add your first platform
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <NoResults query={query} />
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((platform, i) => (
            <PlatformCard
              key={platform._id}
              platform={platform}
              index={i}
              onToggle={(codeId, used) => platforms.toggleCode(platform._id, codeId, used)}
              onDelete={() => setDeleting(platform)}
              onAddCodes={() => setAddingTo(platform)}
            />
          ))}
        </div>
      )}

      {creating && (
        <PlatformForm
          onClose={() => setCreating(false)}
          onSubmit={async ({ name, note, codes }) => {
            const encrypted = await Promise.all(codes.map((c) => encrypt(c)));
            await platforms.create(name, note || undefined, encrypted);
          }}
        />
      )}

      {addingTo && (
        <AddCodesForm
          platformName={addingTo.name}
          onClose={() => setAddingTo(null)}
          onSubmit={async (codes) => {
            const encrypted = await Promise.all(codes.map((c) => encrypt(c)));
            await platforms.addCodes(addingTo._id, encrypted);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete platform?"
        message={`"${deleting?.name}" and all its backup codes will be permanently removed.`}
        confirmLabel="Delete"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await platforms.remove(deleting._id);
          setDeleting(null);
        }}
      />
    </div>
  );
}

function PlatformCard({
  platform,
  index,
  onToggle,
  onDelete,
  onAddCodes,
}: {
  platform: PlatformDto;
  index: number;
  onToggle: (codeId: string, used: boolean) => void;
  onDelete: () => void;
  onAddCodes: () => void;
}) {
  const remaining = platform.backup_codes.filter((c) => !c.is_used).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.05, 0.3) }}
      className="rounded-xl border p-4"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--color-surface-2)' }}>
            <LifeBuoy className="h-4 w-4" style={{ color: 'var(--color-brand-500)' }} />
          </div>
          <div>
            <p className="text-sm font-medium">{platform.name}</p>
            <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
              {remaining} of {platform.backup_codes.length} remaining
              {platform.note ? ` · ${platform.note}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" icon={<Plus className="h-3.5 w-3.5" />} onClick={onAddCodes}>
            Add codes
          </Button>
          <button
            onClick={onDelete}
            title="Delete platform"
            aria-label="Delete platform"
            className="no-drag flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{ color: '#ef4444' }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {platform.backup_codes.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
          No codes stored yet. Use “Add codes” to paste your recovery codes.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {platform.backup_codes.map((code) => (
            <BackupCodeRow key={code._id} code={code} onToggle={(used) => onToggle(code._id, used)} />
          ))}
        </div>
      )}
    </motion.div>
  );
}

function BackupCodeRow({ code, onToggle }: { code: BackupCodeDto; onToggle: (used: boolean) => void }) {
  const { decrypt } = useVaultCrypto();
  const [plain, setPlain] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const { text: animText, animating, play } = useScramble(code.encrypted_code);

  const resolve = async () => {
    if (plain !== null) return plain;
    setBusy(true);
    try {
      const p = await decrypt(code.encrypted_code);
      setPlain(p);
      return p;
    } finally {
      setBusy(false);
    }
  };

  const toggleReveal = async () => {
    if (revealed) {
      play(plain ?? '', 'out', () => setRevealed(false));
      return;
    }
    const p = await resolve();
    setRevealed(true);
    play(p, 'in');
  };

  const copy = async () => {
    const p = await resolve();
    try {
      await navigator.clipboard.writeText(p);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className={cn('flex items-center justify-between gap-2 rounded-lg border px-3 py-2')}
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: code.is_used ? 'var(--color-surface-2)' : 'transparent',
      }}
    >
      <code
        data-selectable="true"
        title={!revealed ? 'Encrypted — click reveal to decrypt' : undefined}
        className="min-w-0 flex-1 truncate font-mono text-sm"
        style={{
          color:
            (animating || (revealed && plain !== null)) && !code.is_used
              ? 'var(--color-fg)'
              : 'var(--color-fg-muted)',
          textDecoration: code.is_used ? 'line-through' : 'none',
        }}
      >
        {animating ? animText : revealed && plain !== null ? plain : maskedCode(code.encrypted_code)}
      </code>

      <div className="flex shrink-0 items-center gap-0.5">
        <Icon label={revealed ? 'Hide' : 'Reveal'} onClick={toggleReveal} disabled={busy || animating}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </Icon>
        <Icon label="Copy" onClick={copy}>
          {copied ? <Check className="h-3.5 w-3.5" style={{ color: '#22c55e' }} /> : <Copy className="h-3.5 w-3.5" />}
        </Icon>
        <Icon
          label={code.is_used ? 'Mark unused' : 'Mark used'}
          onClick={() => onToggle(!code.is_used)}
        >
          {code.is_used ? <RotateCcw className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" style={{ color: '#22c55e' }} />}
        </Icon>
      </div>
    </div>
  );
}

function Icon({
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
      className="no-drag flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
      style={{ color: 'var(--color-fg-muted)' }}
    >
      {children}
    </button>
  );
}

function PlatformForm({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (v: { name: string; note: string; codes: string[] }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [codesText, setCodesText] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const codes = parseCodes(codesText);
      await onSubmit({ name: name.trim(), note, codes });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="New platform"
      description="Backup codes are encrypted on this device before saving."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Create'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 pb-4">
        <TextField label="Platform name" placeholder="e.g. GitHub" value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <CodesTextArea value={codesText} onChange={setCodesText} label="Backup codes (optional)" />
      </div>
    </Modal>
  );
}

function AddCodesForm({
  platformName,
  onClose,
  onSubmit,
}: {
  platformName: string;
  onClose: () => void;
  onSubmit: (codes: string[]) => Promise<void>;
}) {
  const [codesText, setCodesText] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const codes = parseCodes(codesText);
    if (codes.length === 0) return;
    setBusy(true);
    try {
      await onSubmit(codes);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Add codes to ${platformName}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Add codes'}</Button>
        </>
      }
    >
      <div className="pb-4">
        <CodesTextArea value={codesText} onChange={setCodesText} label="One code per line" />
      </div>
    </Modal>
  );
}

function CodesTextArea({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium" style={{ color: 'var(--color-fg-muted)' }}>{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        placeholder={'8fa3-2b9c\n1de7-90ab\nc4f2-7e18'}
        className="rounded-lg border px-3 py-2 font-mono text-sm outline-none focus:border-[var(--color-brand-500)]"
        style={{ backgroundColor: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}
      />
    </div>
  );
}

function maskedCode(cipher: string): string {
  const compact = cipher.replace(/\s+/g, '');
  return compact.length > 16 ? `${compact.slice(0, 16)}…` : compact;
}

function parseCodes(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((c) => c.trim())
    .filter(Boolean);
}
