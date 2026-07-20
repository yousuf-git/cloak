import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Upload,
  TerminalSquare,
  Loader2,
  FileUp,
  ShieldAlert,
  CheckCircle2,
  MessageSquare,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { SecretField } from '@/components/ui/SecretField';
import { RowActions } from '@/components/ui/RowActions';
import { EmptyState, NoResults } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { TextField } from '@/components/ui/TextField';
import { useSshKeys } from '@/hooks/vault';
import { useVaultCrypto } from '@/hooks/useVaultCrypto';
import { useSearch, matchesQuery } from '@/stores/search';
import type { SshKeyDto } from '@/lib/api';
import { detectSshKey, SSH_KEY_VARIANTS, type DetectedSshKey } from '@/lib/ssh-key-detect';
import { saveDownload, pickTextFile, safeFilename, type FileFilter } from '@/lib/native-fs';

const SSH_FILTER: FileFilter[] = [{ name: 'SSH key', extensions: ['pem', 'ppk'] }];

export function SshKeysPage() {
  const { items, isLoading, create, update, remove } = useSshKeys();
  const { encrypt, decrypt } = useVaultCrypto();
  const query = useSearch((s) => s.query);
  const [editing, setEditing] = useState<SshKeyDto | null>(null);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState<SshKeyDto | null>(null);

  const filtered = items.filter((k) => matchesQuery(query, k.title, k.comment, k.note, k.key_type));

  // Export the decrypted key back to its original file format (.pem / .ppk).
  const exportKey = async (item: SshKeyDto) => {
    const content = await decrypt(item.private_key);
    const ext = item.format.toLowerCase(); // 'pem' | 'ppk'
    const { saved } = await saveDownload(safeFilename(item.title, ext), content, {
      filters: SSH_FILTER,
    });
    return saved;
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="SSH Keys"
        description="Import EC2 key-pair files (RSA/ED25519, PEM/PuTTY). Keys are imported from a file, never pasted, and encrypted client-side."
        actions={
          <Button size="sm" icon={<Upload className="h-4 w-4" />} onClick={() => setImporting(true)}>
            Import SSH Key
          </Button>
        }
      />

      {isLoading ? (
        <Loading />
      ) : items.length === 0 ? (
        <EmptyState
          icon={TerminalSquare}
          title="No SSH keys yet"
          description="Import a .pem or .ppk private key file. Cloak detects its type and encrypts it on this device."
          action={
            <Button icon={<Upload className="h-4 w-4" />} onClick={() => setImporting(true)}>
              Import your first key
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <NoResults query={query} />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((item, i) => (
            <motion.div
              key={item._id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.3) }}
              className="rounded-xl border p-4"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--color-surface-2)' }}>
                    <TerminalSquare className="h-4 w-4" style={{ color: 'var(--color-brand-500)' }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <TypeBadge>{item.key_type}</TypeBadge>
                      <TypeBadge>{item.format}</TypeBadge>
                      {item.comment && (
                        <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                          <MessageSquare className="h-3 w-3" />
                          {item.comment}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <RowActions
                  onDownload={() => exportKey(item)}
                  onEdit={() => setEditing(item)}
                  onDelete={() => setDeleting(item)}
                />
              </div>

              <SecretField cipher={item.private_key} reveal={() => decrypt(item.private_key)} maskLength={40} />
              {item.note && (
                <p className="mt-3 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                  {item.note}
                </p>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {importing && (
        <ImportSshKeyModal
          onClose={() => setImporting(false)}
          onImport={async (v) => {
            await create({
              title: v.title,
              key_type: v.detected.key_type,
              format: v.detected.format,
              comment: v.detected.comment,
              private_key: await encrypt(v.content),
              note: v.note || undefined,
            });
          }}
        />
      )}

      {editing && (
        <EditSshKeyModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={async (v) => {
            await update(editing._id, { title: v.title, note: v.note });
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete SSH key?"
        message={`"${deleting?.title}" will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await remove(deleting._id);
          setDeleting(null);
        }}
      />
    </div>
  );
}

// ------------------------------------------------------------------ Import ---

interface ImportValues {
  title: string;
  note: string;
  content: string;
  detected: DetectedSshKey;
}

function ImportSshKeyModal({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (v: ImportValues) => Promise<void>;
}) {
  const [detected, setDetected] = useState<DetectedSshKey | null>(null);
  const [content, setContent] = useState('');
  const [filename, setFilename] = useState('');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chooseFile = async () => {
    setError(null);
    try {
      const picked = await pickTextFile(SSH_FILTER);
      if (!picked) return;
      const result = detectSshKey(picked.content);
      if (!result) {
        setDetected(null);
        setContent('');
        setError(
          'Unsupported key file. Import an RSA or ED25519 private key in PEM (.pem) or PuTTY (.ppk) format.',
        );
        return;
      }
      setDetected(result);
      setContent(picked.content);
      setFilename(picked.name);
      // Seed a title from the filename (sans extension) on first import.
      setTitle((t) => t || picked.name.replace(/\.(pem|ppk|key|txt)$/i, ''));
    } catch {
      setError('Could not read that file.');
    }
  };

  const runImport = async () => {
    if (!detected || !content || !title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onImport({ title: title.trim(), note, content, detected });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Import SSH key"
      description="Choose a private key file — Cloak detects its type and encrypts it on this device. Keys cannot be pasted."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={runImport} disabled={busy || !detected || !title.trim()}>
            {busy ? 'Importing…' : 'Import'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 pb-4">
        {/* Supported formats reference — guides the user before they pick a file. */}
        <div className="rounded-lg border p-3" style={{ borderColor: 'var(--color-border)' }}>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-fg-muted)' }}>
            Supported key files
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {SSH_KEY_VARIANTS.map((v) => {
              const active = detected?.key_type === v.key_type && detected?.format === v.format;
              return (
                <div
                  key={v.label}
                  className="flex flex-col gap-0.5 rounded-md px-2 py-1.5"
                  style={{
                    backgroundColor: active
                      ? 'color-mix(in srgb, var(--color-brand-500) 14%, transparent)'
                      : 'var(--color-surface-2)',
                  }}
                >
                  <span className="flex items-center gap-1.5 text-[11px] font-medium">
                    {active && <CheckCircle2 className="h-3 w-3" style={{ color: 'var(--color-brand-500)' }} />}
                    {v.label} <span style={{ color: 'var(--color-fg-muted)' }}>({v.ext})</span>
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--color-fg-muted)' }}>
                    {v.usedWith}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={chooseFile}
          className="no-drag flex items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-3 text-sm font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-brand-500)' }}
        >
          <FileUp className="h-4 w-4" />
          {detected ? 'Choose a different file' : 'Choose key file (.pem / .ppk)'}
        </button>

        {detected && (
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-[11px]"
            style={{ backgroundColor: 'var(--color-surface-2)' }}
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: '#16a34a' }} />
            <span>
              Detected <strong>{detected.variant.label}</strong>
              {filename ? <> from <code className="font-mono">{filename}</code></> : null}
              {detected.comment ? <> · comment “{detected.comment}”</> : null}
            </span>
          </div>
        )}

        {detected && (
          <>
            <TextField label="Title" placeholder="e.g. prod-web bastion" value={title} onChange={(e) => setTitle(e.target.value)} />
            <TextField label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          </>
        )}

        {error && (
          <p className="flex items-center gap-1.5 text-[11px]" style={{ color: '#dc2626' }}>
            <ShieldAlert className="h-3.5 w-3.5" />
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

// -------------------------------------------------------------------- Edit ---

function EditSshKeyModal({
  initial,
  onClose,
  onSubmit,
}: {
  initial: SshKeyDto;
  onClose: () => void;
  onSubmit: (v: { title: string; note: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState(initial.title);
  const [note, setNote] = useState(initial.note ?? '');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await onSubmit({ title: title.trim(), note });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit SSH key"
      description="Key material is fixed once imported — only the title and note can change."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 pb-4">
        <div className="flex items-center gap-1.5">
          <TypeBadge>{initial.key_type}</TypeBadge>
          <TypeBadge>{initial.format}</TypeBadge>
        </div>
        <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <TextField label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  );
}

function TypeBadge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[10px] font-medium"
      style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-fg-muted)' }}
    >
      {children}
    </span>
  );
}

function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--color-fg-muted)' }} />
    </div>
  );
}
