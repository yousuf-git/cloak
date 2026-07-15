import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  KeyRound,
  Link2,
  Loader2,
  Copy,
  Check,
  Upload,
  Download,
  FileUp,
  ShieldAlert,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { SecretField } from '@/components/ui/SecretField';
import { RowActions } from '@/components/ui/RowActions';
import { EmptyState, NoResults } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { TextField } from '@/components/ui/TextField';
import { useCreds } from '@/hooks/vault';
import { useVaultCrypto } from '@/hooks/useVaultCrypto';
import { useSearch, matchesQuery } from '@/stores/search';
import type { CredDto } from '@/lib/api';
import {
  parseCsv,
  autoMap,
  toImportRows,
  normalizeRow,
  CRED_FIELDS,
  type ColumnMapping,
  type CredField,
  type ImportRow,
} from '@/lib/csv-parse';
import {
  credsToCsv,
  downloadText,
  encryptBackup,
  decryptBackup,
  asBackupEnvelope,
} from '@/lib/vault-export';

export function CredentialsPage() {
  const { items, isLoading, create, update, remove } = useCreds();
  const { encrypt, decrypt } = useVaultCrypto();
  const query = useSearch((s) => s.query);
  const [editing, setEditing] = useState<CredDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<CredDto | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const filtered = items.filter((c) => matchesQuery(query, c.name, c.url, c.note));

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Credentials"
        description="Passwords encrypted with your Master Key and masked by default; usernames kept as searchable plaintext."
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              icon={<Upload className="h-4 w-4" />}
              onClick={() => setImporting(true)}
            >
              Import
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={<Download className="h-4 w-4" />}
              onClick={() => setExporting(true)}
              disabled={items.length === 0}
            >
              Export
            </Button>
            <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
              New Credential
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <Loading />
      ) : items.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="No credentials yet"
          description="Store your first username & password. It's encrypted on this device before it ever syncs."
          action={
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
              Add your first credential
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <NoResults query={query} />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((cred, i) => (
            <motion.div
              key={cred._id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.3) }}
              className="rounded-xl border p-4"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--color-surface-2)' }}>
                    <KeyRound className="h-4 w-4" style={{ color: 'var(--color-brand-500)' }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{cred.name}</p>
                    {cred.url && (
                      <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                        <Link2 className="h-3 w-3" />
                        {cred.url}
                      </span>
                    )}
                  </div>
                </div>
                <RowActions onEdit={() => setEditing(cred)} onDelete={() => setDeleting(cred)} />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Username">
                  <PlainField value={cred.username} />
                </Field>
                <Field label="Password">
                  <SecretField cipher={cred.password} reveal={() => decrypt(cred.password)} maskLength={20} />
                </Field>
              </div>
              {cred.note && (
                <p className="mt-3 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                  {cred.note}
                </p>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <CredentialForm
          initial={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSubmit={async (values) => {
            const payload: Partial<CredDto> = {
              name: values.name,
              url: values.url || undefined,
              note: values.note || undefined,
              username: values.username, // plaintext — username is not a secret
              password: await encrypt(values.password),
            };
            if (editing) await update(editing._id, payload);
            else await create(payload);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete credential?"
        message={`"${deleting?.name}" will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await remove(deleting._id);
          setDeleting(null);
        }}
      />

      {importing && (
        <ImportCredsModal
          existing={items}
          onClose={() => setImporting(false)}
          onImport={async (rows) => {
            for (const r of rows) {
              await create({
                name: r.name,
                url: r.url || undefined,
                note: r.note || undefined,
                username: r.username,
                password: await encrypt(r.password),
              });
            }
          }}
        />
      )}

      {exporting && <ExportCredsModal items={items} onClose={() => setExporting(false)} />}
    </div>
  );
}

interface FormValues {
  name: string;
  url: string;
  username: string;
  password: string;
  note: string;
}

function CredentialForm({
  initial,
  onClose,
  onSubmit,
}: {
  initial: CredDto | null;
  onClose: () => void;
  onSubmit: (v: FormValues) => Promise<void>;
}) {
  const { decrypt } = useVaultCrypto();
  const [values, setValues] = useState<FormValues>({
    name: initial?.name ?? '',
    url: initial?.url ?? '',
    username: '',
    password: '',
    note: initial?.note ?? '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  // Prefill on edit: username is plaintext; only the password needs decrypting.
  useEffect(() => {
    if (!initial) return;
    setValues((v) => ({ ...v, username: initial.username }));
    decrypt(initial.password)
      .then((p) => setValues((v) => ({ ...v, password: p })))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    if (!values.name.trim() || !values.username || !values.password) return;
    setBusy(true);
    try {
      await onSubmit(values);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? 'Edit credential' : 'New credential'}
      description="Secrets are encrypted on this device before saving."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : initial ? 'Save changes' : 'Create'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 pb-4">
        <TextField label="Name" placeholder="e.g. AWS Root Console" value={values.name} onChange={set('name')} />
        <TextField label="URL (optional)" placeholder="console.aws.amazon.com" value={values.url} onChange={set('url')} />
        <TextField label="Username" value={values.username} onChange={set('username')} />
        <TextField label="Password" revealToggle value={values.password} onChange={set('password')} />
        <TextField label="Note (optional)" value={values.note} onChange={set('note')} />
      </div>
    </Modal>
  );
}

/** Plaintext value display (username is not a secret — no mask/decrypt). */
function PlainField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="flex items-center gap-2">
      <code
        data-selectable="true"
        className="min-w-0 flex-1 truncate rounded-md px-2.5 py-1.5 font-mono text-xs"
        style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-fg)' }}
      >
        {value}
      </code>
      <button
        onClick={copy}
        title="Copy"
        aria-label="Copy"
        className="no-drag flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/5"
        style={{ color: 'var(--color-fg-muted)' }}
      >
        {copied ? <Check className="h-3.5 w-3.5" style={{ color: '#22c55e' }} /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-fg-muted)' }}>
        {label}
      </p>
      {children}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--color-fg-muted)' }} />
    </div>
  );
}

// ------------------------------------------------------------------ Import ---

const dedupeKey = (name: string, username: string) =>
  `${name.trim().toLowerCase()}|${username.trim().toLowerCase()}`;

function ImportCredsModal({
  existing,
  onClose,
  onImport,
}: {
  existing: CredDto[];
  onClose: () => void;
  onImport: (rows: ImportRow[]) => Promise<void>;
}) {
  const [raw, setRaw] = useState('');
  const [decrypted, setDecrypted] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [mapping, setMapping] = useState<ColumnMapping>({
    name: null,
    url: null,
    username: null,
    password: null,
    note: null,
  });
  const [dedupe, setDedupe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const envelope = decrypted === null ? asBackupEnvelope(raw) : null;
  const source = decrypted ?? raw;
  const parsed = source.trim() && !envelope ? parseCsv(source) : null;
  const headerKey = parsed?.headers.join('') ?? '';

  // Re-run auto-mapping whenever a new set of headers appears.
  useEffect(() => {
    if (parsed) setMapping(autoMap(parsed.headers));
  }, [headerKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const mappedRows = parsed ? toImportRows(parsed, mapping).map(normalizeRow) : [];
  const existingKeys = new Set(existing.map((c) => dedupeKey(c.name, c.username)));
  const seen = new Set<string>();
  const finalRows = mappedRows.filter((r) => {
    if (!dedupe) return true;
    const k = dedupeKey(r.name, r.username);
    if (existingKeys.has(k) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const skipped = mappedRows.length - finalRows.length;

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const text = await file.text();
      setRaw(text);
      setDecrypted(null);
    } catch {
      setError('Could not read that file.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const decryptBackupNow = async () => {
    if (!envelope) return;
    setBusy(true);
    setError(null);
    try {
      setDecrypted(await decryptBackup(passphrase, envelope));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not decrypt backup.');
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    if (!finalRows.length) return;
    setBusy(true);
    setError(null);
    try {
      await onImport(finalRows);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  };

  const columnOptions = [
    { value: '', label: '— none —' },
    ...(parsed?.headers.map((h, i) => ({ value: String(i), label: h || `Column ${i + 1}` })) ?? []),
  ];

  return (
    <Modal
      open
      onClose={onClose}
      title="Import credentials"
      description="Import a Google Password Manager CSV or a Cloak encrypted backup. Passwords are encrypted on this device before saving."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          {envelope ? (
            <Button onClick={decryptBackupNow} disabled={busy || !passphrase}>
              {busy ? 'Decrypting…' : 'Decrypt backup'}
            </Button>
          ) : (
            <Button onClick={runImport} disabled={busy || finalRows.length === 0}>
              {busy ? 'Importing…' : `Import ${finalRows.length || ''}`.trim()}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-3 pb-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium" style={{ color: 'var(--color-fg-muted)' }}>
              Paste CSV or backup contents
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.cloak,.json,.txt,text/csv,text/plain,application/json"
              onChange={onFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="no-drag inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{ color: 'var(--color-brand-500)' }}
            >
              <FileUp className="h-3.5 w-3.5" />
              Choose file
            </button>
          </div>
          <textarea
            value={decrypted ?? raw}
            onChange={(e) => {
              setRaw(e.target.value);
              setDecrypted(null);
            }}
            readOnly={decrypted !== null}
            rows={6}
            spellCheck={false}
            placeholder={'name,url,username,password,note\nGitHub,https://github.com,octocat,••••••,'}
            className="rounded-lg border px-3 py-2 font-mono text-xs outline-none focus:border-[var(--color-brand-500)]"
            style={{ backgroundColor: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
          />
        </div>

        {envelope && (
          <div className="flex flex-col gap-1.5">
            <p className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--color-fg-muted)' }}>
              <Lock className="h-3.5 w-3.5" />
              Encrypted Cloak backup detected — enter its passphrase to continue.
            </p>
            <TextField
              label="Backup passphrase"
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
            />
          </div>
        )}

        {parsed && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {CRED_FIELDS.map((field) => (
                <Select
                  key={field}
                  label={fieldLabel(field)}
                  value={mapping[field] === null ? '' : String(mapping[field])}
                  onChange={(v) =>
                    setMapping((m) => ({ ...m, [field]: v === '' ? null : Number(v) }))
                  }
                  options={columnOptions}
                />
              ))}
            </div>

            <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
              <input type="checkbox" checked={dedupe} onChange={(e) => setDedupe(e.target.checked)} />
              Skip duplicates (same name &amp; username)
            </label>

            {mapping.password === null && (
              <p className="flex items-center gap-1.5 text-[11px]" style={{ color: '#dc2626' }}>
                <ShieldAlert className="h-3.5 w-3.5" />
                Map the Password column to import.
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <p className="flex items-center gap-1.5 text-[11px]" style={{ color: '#16a34a' }}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                {finalRows.length} to import
                {skipped > 0 ? ` · ${skipped} duplicate${skipped === 1 ? '' : 's'} skipped` : ''}
              </p>
              {finalRows.length > 0 && (
                <div className="max-h-40 overflow-auto rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr style={{ color: 'var(--color-fg-muted)' }}>
                        <th className="px-2 py-1 font-medium">Name</th>
                        <th className="px-2 py-1 font-medium">Username</th>
                        <th className="px-2 py-1 font-medium">Password</th>
                      </tr>
                    </thead>
                    <tbody>
                      {finalRows.slice(0, 8).map((r, i) => (
                        <tr key={i} style={{ borderTop: '1px solid var(--color-border)' }}>
                          <td className="truncate px-2 py-1">{r.name}</td>
                          <td className="truncate px-2 py-1">{r.username || '—'}</td>
                          <td className="px-2 py-1 font-mono">{r.password ? '••••••' : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
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

function fieldLabel(field: CredField): string {
  return field.charAt(0).toUpperCase() + field.slice(1);
}

// ------------------------------------------------------------------ Export ---

function ExportCredsModal({ items, onClose }: { items: CredDto[]; onClose: () => void }) {
  const { decrypt } = useVaultCrypto();
  const [mode, setMode] = useState<'encrypted' | 'plain'>('encrypted');
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [acknowledge, setAcknowledge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildRows = async (): Promise<ImportRow[]> =>
    Promise.all(
      items.map(async (c) => ({
        name: c.name,
        url: c.url ?? '',
        username: c.username, // plaintext
        password: await decrypt(c.password),
        note: c.note ?? '',
      })),
    );

  const canExport =
    mode === 'plain'
      ? acknowledge
      : passphrase.length >= 8 && passphrase === confirm;

  const runExport = async () => {
    setBusy(true);
    setError(null);
    try {
      const rows = await buildRows();
      const csv = credsToCsv(rows);
      if (mode === 'plain') {
        downloadText('cloak-credentials.csv', csv, 'text/csv');
      } else {
        const envelope = await encryptBackup(passphrase, csv);
        downloadText('cloak-backup.cloak', envelope, 'application/json');
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Export credentials"
      description={`Export all ${items.length} credential${items.length === 1 ? '' : 's'}.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={runExport} disabled={busy || !canExport}>
            {busy ? 'Exporting…' : 'Export'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 pb-4">
        <div className="grid grid-cols-2 gap-2">
          <ModeCard
            active={mode === 'encrypted'}
            onClick={() => setMode('encrypted')}
            icon={<Lock className="h-4 w-4" />}
            title="Encrypted backup"
            hint="Passphrase-protected .cloak file"
          />
          <ModeCard
            active={mode === 'plain'}
            onClick={() => setMode('plain')}
            icon={<ShieldAlert className="h-4 w-4" />}
            title="Plaintext CSV"
            hint="Google-compatible, unprotected"
          />
        </div>

        {mode === 'encrypted' ? (
          <>
            <TextField
              label="Passphrase (min 8 chars)"
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
            />
            <TextField
              label="Confirm passphrase"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {confirm.length > 0 && passphrase !== confirm && (
              <p className="text-[11px]" style={{ color: '#dc2626' }}>
                Passphrases don't match.
              </p>
            )}
            <p className="text-[11px]" style={{ color: 'var(--color-fg-muted)' }}>
              You'll need this passphrase to import the backup later. It cannot be recovered.
            </p>
          </>
        ) : (
          <label
            className="flex items-start gap-2 rounded-lg border p-3 text-xs"
            style={{ borderColor: '#dc2626', color: 'var(--color-fg)' }}
          >
            <input
              type="checkbox"
              checked={acknowledge}
              onChange={(e) => setAcknowledge(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I understand this file contains <strong>every password in plaintext</strong>, is not
              encrypted, and anyone who opens it can read my secrets.
            </span>
          </label>
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

function ModeCard({
  active,
  onClick,
  icon,
  title,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors"
      style={{
        borderColor: active ? 'var(--color-brand-500)' : 'var(--color-border)',
        backgroundColor: active ? 'var(--color-surface-2)' : 'transparent',
      }}
    >
      <span className="flex items-center gap-1.5 text-xs font-medium">
        {icon}
        {title}
      </span>
      <span className="text-[11px]" style={{ color: 'var(--color-fg-muted)' }}>
        {hint}
      </span>
    </button>
  );
}
