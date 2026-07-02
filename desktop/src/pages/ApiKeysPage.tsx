import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, ShieldCheck, Link2, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { SecretField } from '@/components/ui/SecretField';
import { RowActions } from '@/components/ui/RowActions';
import { EmptyState, NoResults } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { TextField } from '@/components/ui/TextField';
import { useApiKeys } from '@/hooks/vault';
import { useVaultCrypto } from '@/hooks/useVaultCrypto';
import { useSearch, matchesQuery } from '@/stores/search';
import type { ApiKeyDto } from '@/lib/api';

export function ApiKeysPage() {
  const { items, isLoading, create, update, remove } = useApiKeys();
  const { encrypt, decrypt } = useVaultCrypto();
  const query = useSearch((s) => s.query);
  const [editing, setEditing] = useState<ApiKeyDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<ApiKeyDto | null>(null);

  const filtered = items.filter((k) => matchesQuery(query, k.label, k.url, k.note));

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="API Keys"
        description="Provider tokens and secret keys, encrypted client-side and revealed only on demand."
        actions={
          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
            New API Key
          </Button>
        }
      />

      {isLoading ? (
        <Loading />
      ) : items.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No API keys yet"
          description="Keep Stripe, OpenAI, and other provider keys in one encrypted place."
          action={
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
              Add your first API key
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
                    <ShieldCheck className="h-4 w-4" style={{ color: 'var(--color-brand-500)' }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    {item.url && (
                      <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                        <Link2 className="h-3 w-3" />
                        {item.url}
                      </span>
                    )}
                  </div>
                </div>
                <RowActions onEdit={() => setEditing(item)} onDelete={() => setDeleting(item)} />
              </div>

              <SecretField cipher={item.key} reveal={() => decrypt(item.key)} maskLength={32} />
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
        <ApiKeyForm
          initial={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSubmit={async (values) => {
            const payload: Partial<ApiKeyDto> = {
              label: values.label,
              url: values.url || undefined,
              note: values.note || undefined,
              key: await encrypt(values.key),
            };
            if (editing) await update(editing._id, payload);
            else await create(payload);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete API key?"
        message={`"${deleting?.label}" will be permanently removed. This cannot be undone.`}
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
  label: string;
  url: string;
  key: string;
  note: string;
}

function ApiKeyForm({
  initial,
  onClose,
  onSubmit,
}: {
  initial: ApiKeyDto | null;
  onClose: () => void;
  onSubmit: (v: FormValues) => Promise<void>;
}) {
  const { decrypt } = useVaultCrypto();
  const [values, setValues] = useState<FormValues>({
    label: initial?.label ?? '',
    url: initial?.url ?? '',
    key: '',
    note: initial?.note ?? '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  useEffect(() => {
    if (!initial) return;
    decrypt(initial.key)
      .then((k) => setValues((v) => ({ ...v, key: k })))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    if (!values.label.trim() || !values.key) return;
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
      title={initial ? 'Edit API key' : 'New API key'}
      description="The key is encrypted on this device before saving."
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
        <TextField label="Label" placeholder="e.g. Stripe — Live" value={values.label} onChange={set('label')} />
        <TextField label="URL (optional)" placeholder="stripe.com" value={values.url} onChange={set('url')} />
        <TextField label="Key" revealToggle value={values.key} onChange={set('key')} />
        <TextField label="Note (optional)" value={values.note} onChange={set('note')} />
      </div>
    </Modal>
  );
}

function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--color-fg-muted)' }} />
    </div>
  );
}
