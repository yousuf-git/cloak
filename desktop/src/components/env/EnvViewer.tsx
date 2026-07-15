import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Unlock, Lock, Pencil, Trash2, Save, Loader2, Copy, Check, ShieldAlert, Info } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useScramble } from '@/components/ui/SecretField';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { EnvFileDto } from '@/lib/api';
import type { DecryptResult } from '@/hooks/useEnvFiles';

interface EnvViewerProps {
  file: EnvFileDto;
  onClose: () => void;
  getRaw: (id: string) => Promise<string>;
  decrypt: (file: EnvFileDto) => Promise<DecryptResult>;
  saveEdit: (file: EnvFileDto, plaintext: string, publicKeyHex: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function EnvViewer({ file, onClose, getRaw, decrypt, saveEdit, remove }: EnvViewerProps) {
  const canDecrypt = Boolean(file.encrypted_dotenvx_key);
  const [raw, setRaw] = useState<string | null>(null);
  const [decrypted, setDecrypted] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Scramble the whole blob between ciphertext and plaintext on decrypt/encrypt.
  const { text: animText, animating, play } = useScramble(raw ?? undefined);

  useEffect(() => {
    getRaw(file._id)
      .then(setRaw)
      .catch(() => setError('Could not load the encrypted file.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file._id]);

  const showingDecrypted = decrypted !== null;
  const content = editing
    ? draft
    : animating
      ? animText
      : showingDecrypted
        ? decrypted
        : (raw ?? '');
  const dirty = editing && draft !== decrypted;

  const doDecrypt = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await decrypt(file);
      setDecrypted(r.plaintext);
      setPublicKey(r.publicKeyHex);
      play(r.plaintext, 'in');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Decryption failed.');
    } finally {
      setBusy(false);
    }
  };

  // Reverse of decrypt — dissolve plaintext back to ciphertext, then re-mask.
  const doEncrypt = () => {
    play(decrypted ?? '', 'out', () => {
      setDecrypted(null);
      setPublicKey(null);
    });
  };

  const startEdit = () => {
    setDraft(decrypted ?? '');
    setEditing(true);
  };

  const save = async () => {
    if (!publicKey) return;
    setBusy(true);
    setError(null);
    try {
      if (dirty) await saveEdit(file, draft, publicKey);
      setDecrypted(draft);
      setEditing(false);
      // Refresh the raw view to reflect re-encrypted content.
      await getRaw(file._id).then(setRaw).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-10 flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border shadow-2xl"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center justify-between gap-3 border-b p-4" style={{ borderColor: 'var(--color-border)' }}>
          <div className="min-w-0">
            <p className="truncate font-mono text-sm font-medium">{file.label}</p>
            <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
              {showingDecrypted ? 'Decrypted' : 'Encrypted'} · {file.variable_count} variables
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="no-drag flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{ color: 'var(--color-fg-muted)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden p-4">
          {raw === null && !error ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--color-fg-muted)' }} />
            </div>
          ) : (
            <textarea
              value={content}
              readOnly={!editing}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              className="h-[42vh] w-full resize-none rounded-lg border p-3 font-mono text-xs leading-relaxed outline-none focus:border-[var(--color-brand-500)]"
              style={{
                backgroundColor: 'var(--color-surface-2)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-fg)',
              }}
            />
          )}

          {error && (
            <p className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: '#dc2626' }}>
              <ShieldAlert className="h-3.5 w-3.5" /> {error}
            </p>
          )}

          {!canDecrypt && (
            <p className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
              <Info className="h-3.5 w-3.5" />
              No decryption key stored for this file — it was imported pre-encrypted without a key, so
              it can only be viewed and copied in its encrypted form.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t p-4" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" icon={copied ? <Check className="h-3.5 w-3.5" style={{ color: '#22c55e' }} /> : <Copy className="h-3.5 w-3.5" />} onClick={copy}>
              Copy
            </Button>
            {showingDecrypted && !editing ? (
              <Button
                size="sm"
                variant="outline"
                icon={<Lock className="h-3.5 w-3.5" />}
                onClick={doEncrypt}
                disabled={busy || animating}
                title="Hide — re-mask the decrypted values"
              >
                Encrypt
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                icon={busy && !editing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlock className="h-3.5 w-3.5" />}
                onClick={doDecrypt}
                disabled={!canDecrypt || busy || animating || showingDecrypted || editing}
                title={canDecrypt ? 'Decrypt with your master key' : 'No key stored — cannot decrypt'}
              >
                Decrypt
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {showingDecrypted && !editing && !animating && (
              <Button size="sm" variant="outline" icon={<Pencil className="h-3.5 w-3.5" />} onClick={startEdit}>
                Edit
              </Button>
            )}
            {editing && (
              <Button size="sm" icon={busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} onClick={save} disabled={busy}>
                {dirty ? 'Save changes' : 'Done'}
              </Button>
            )}
            <Button size="sm" variant="danger" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          </div>
        </div>
      </motion.div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete env file?"
        message={`"${file.label}" will be removed from storage and its metadata deleted. This cannot be undone.`}
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await remove(file._id);
          setConfirmDelete(false);
          onClose();
        }}
      />
    </motion.div>
  );
}
