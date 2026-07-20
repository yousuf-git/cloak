import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  KeySquare,
  Loader2,
  Copy,
  Check,
  FileUp,
  Download,
  ShieldAlert,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { SecretField } from '@/components/ui/SecretField';
import { RowActions } from '@/components/ui/RowActions';
import { EmptyState, NoResults } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { TextField } from '@/components/ui/TextField';
import { useAccessKeys } from '@/hooks/vault';
import { useVaultCrypto } from '@/hooks/useVaultCrypto';
import { useSearch, matchesQuery } from '@/stores/search';
import type { AccessKeyDto } from '@/lib/api';
import { ACCESS_KEY_SAMPLE_CSV, accessKeyToCsv, parseAccessKeyCsv } from '@/lib/access-key-csv';
import { saveDownload, pickTextFile, safeFilename, type FileFilter } from '@/lib/native-fs';

const CSV_FILTER: FileFilter[] = [{ name: 'CSV', extensions: ['csv'] }];

export function AccessKeysPage() {
  const { items, isLoading, create, update, remove } = useAccessKeys();
  const { encrypt, decrypt } = useVaultCrypto();
  const query = useSearch((s) => s.query);
  const [editing, setEditing] = useState<AccessKeyDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<AccessKeyDto | null>(null);

  const filtered = items.filter((k) => matchesQuery(query, k.title, k.access_key_id, k.note));

  // Export one access key as an AWS-shaped credentials CSV.
  const exportKey = async (item: AccessKeyDto) => {
    const secret = await decrypt(item.secret_access_key);
    const { saved } = await saveDownload(
      safeFilename(item.title, 'csv'),
      accessKeyToCsv(item.access_key_id, secret),
      { mime: 'text/csv', filters: CSV_FILTER },
    );
    return saved;
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Access Keys"
        description="Access key ID + secret access key pairs (AWS IAM and the like). The secret is encrypted client-side and revealed only on demand."
        actions={
          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
            New Access Key
          </Button>
        }
      />

      {isLoading ? (
        <Loading />
      ) : items.length === 0 ? (
        <EmptyState
          icon={KeySquare}
          title="No access keys yet"
          description="Store AWS IAM access keys and other ID + secret pairs. Enter them by hand or import an AWS credentials CSV."
          action={
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
              Add your first access key
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
                    <KeySquare className="h-4 w-4" style={{ color: 'var(--color-brand-500)' }} />
                  </div>
                  <p className="text-sm font-medium">{item.title}</p>
                </div>
                <RowActions
                  onDownload={() => exportKey(item)}
                  onEdit={() => setEditing(item)}
                  onDelete={() => setDeleting(item)}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Access Key ID">
                  <PlainField value={item.access_key_id} />
                </Field>
                <Field label="Secret Access Key">
                  <SecretField cipher={item.secret_access_key} reveal={() => decrypt(item.secret_access_key)} maskLength={24} />
                </Field>
              </div>
              {item.note && (
                <p className="mt-3 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                  {item.note}
                </p>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <AccessKeyForm
          initial={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSubmit={async (values) => {
            const payload: Partial<AccessKeyDto> = {
              title: values.title,
              access_key_id: values.accessKeyId,
              secret_access_key: await encrypt(values.secretAccessKey),
              note: values.note || undefined,
            };
            if (editing) await update(editing._id, payload);
            else await create(payload);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete access key?"
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

interface FormValues {
  title: string;
  accessKeyId: string;
  secretAccessKey: string;
  note: string;
}

function AccessKeyForm({
  initial,
  onClose,
  onSubmit,
}: {
  initial: AccessKeyDto | null;
  onClose: () => void;
  onSubmit: (v: FormValues) => Promise<void>;
}) {
  const { decrypt } = useVaultCrypto();
  const [values, setValues] = useState<FormValues>({
    title: initial?.title ?? '',
    accessKeyId: initial?.access_key_id ?? '',
    secretAccessKey: '',
    note: initial?.note ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);

  const set = (k: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  // access_key_id is plaintext; only the secret needs decrypting on edit.
  useEffect(() => {
    if (!initial) return;
    decrypt(initial.secret_access_key)
      .then((s) => setValues((v) => ({ ...v, secretAccessKey: s })))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const importCsv = async () => {
    setCsvError(null);
    try {
      const picked = await pickTextFile(CSV_FILTER);
      if (!picked) return;
      const pair = parseAccessKeyCsv(picked.content);
      if (!pair) {
        setCsvError('No “Access key ID / Secret access key” pair found in that CSV.');
        return;
      }
      setValues((v) => ({
        ...v,
        accessKeyId: pair.accessKeyId || v.accessKeyId,
        secretAccessKey: pair.secretAccessKey || v.secretAccessKey,
      }));
    } catch {
      setCsvError('Could not read that file.');
    }
  };

  const submit = async () => {
    if (!values.title.trim() || !values.accessKeyId.trim() || !values.secretAccessKey) return;
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
      title={initial ? 'Edit access key' : 'New access key'}
      description="The secret access key is encrypted on this device before saving."
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
        {!initial && (
          <div
            className="flex items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-2"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <span className="text-[11px]" style={{ color: 'var(--color-fg-muted)' }}>
              Import an AWS credentials CSV to fill the key fields
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={importCsv}
                className="no-drag inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                style={{ color: 'var(--color-brand-500)' }}
              >
                <FileUp className="h-3.5 w-3.5" />
                Import CSV
              </button>
              <button
                type="button"
                onClick={() =>
                  saveDownload('aws-access-key-sample.csv', ACCESS_KEY_SAMPLE_CSV, {
                    mime: 'text/csv',
                    filters: CSV_FILTER,
                  })
                }
                className="no-drag inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                style={{ color: 'var(--color-fg-muted)' }}
              >
                <Download className="h-3.5 w-3.5" />
                Sample
              </button>
            </div>
          </div>
        )}

        {csvError && (
          <p className="flex items-center gap-1.5 text-[11px]" style={{ color: '#dc2626' }}>
            <ShieldAlert className="h-3.5 w-3.5" />
            {csvError}
          </p>
        )}

        <TextField label="Title" placeholder="e.g. AWS — Deploy Bot" value={values.title} onChange={set('title')} />
        <TextField label="Access Key ID" placeholder="AKIA…" value={values.accessKeyId} onChange={set('accessKeyId')} />
        <TextField label="Secret Access Key" revealToggle value={values.secretAccessKey} onChange={set('secretAccessKey')} />
        <TextField label="Note (optional)" value={values.note} onChange={set('note')} />
      </div>
    </Modal>
  );
}

/** Plaintext value display (access key ID is a searchable identifier, not a secret). */
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
