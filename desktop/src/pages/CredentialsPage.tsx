import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, KeyRound, Link2, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { SecretField } from '@/components/ui/SecretField';
import { RowActions } from '@/components/ui/RowActions';
import { EmptyState, NoResults } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { TextField } from '@/components/ui/TextField';
import { useCreds } from '@/hooks/vault';
import { useVaultCrypto } from '@/hooks/useVaultCrypto';
import { useSearch, matchesQuery } from '@/stores/search';
import type { CredDto } from '@/lib/api';

export function CredentialsPage() {
  const { items, isLoading, create, update, remove } = useCreds();
  const { encrypt, decrypt } = useVaultCrypto();
  const query = useSearch((s) => s.query);
  const [editing, setEditing] = useState<CredDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<CredDto | null>(null);

  const filtered = items.filter((c) => matchesQuery(query, c.name, c.url, c.note));

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Credentials"
        description="Usernames and passwords, encrypted with your Master Key and masked by default."
        actions={
          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
            New Credential
          </Button>
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
                  <SecretField cipher={cred.username} reveal={() => decrypt(cred.username)} maskLength={16} />
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
              username: await encrypt(values.username),
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

  // Prefill secrets when editing (decrypt on open).
  useEffect(() => {
    if (!initial) return;
    Promise.all([decrypt(initial.username), decrypt(initial.password)])
      .then(([u, p]) => setValues((v) => ({ ...v, username: u, password: p })))
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
