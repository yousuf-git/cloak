import { useState } from 'react';
import { Building2, Plus, LifeBuoy, Trash2, Loader2, Clock } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { TextField } from '@/components/ui/TextField';
import { useOrg } from '@/hooks/useOrg';
import { useMyFingerprint } from '@/hooks/team';
import { KeyFingerprint } from '@/components/ui/KeyFingerprint';
import { useOrgs } from '@/stores/org';
import { orgApi } from '@/lib/api';
import { crypto } from '@/lib/tauri-crypto';
import { toast } from '@/stores/toast';

export function OrgSettingsPage() {
  const { org, orgId, can, isLocked } = useOrg();
  const orgs = useOrgs((s) => s.orgs);
  const refresh = useOrgs((s) => s.refresh);
  const createOrg = useOrgs((s) => s.createOrg);

  const [name, setName] = useState(org?.name ?? '');
  const [renaming, setRenaming] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [breakGlass, setBreakGlass] = useState(false);
  const [newOrgKey, setNewOrgKey] = useState<string | null>(null);
  const { data: myFingerprint, isLoading: fingerprintLoading } = useMyFingerprint();
  const pending = orgs.filter((o) => o.status === 'pending_key');

  if (!org || !orgId) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--color-fg-muted)' }} />
      </div>
    );
  }

  const rename = async () => {
    setRenaming(true);
    try {
      await orgApi.rename(orgId, name.trim());
      await refresh();
      toast.success('Organization renamed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rename failed');
    } finally {
      setRenaming(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <PageHeader
        title="Organization"
        description="Everything in your vault belongs to an organization. You can have more than one."
        actions={
          <Button size="sm" variant="outline" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
            New organization
          </Button>
        }
      />

      <div className="flex max-w-2xl flex-col gap-6">
        {isLocked && (
          <div
            className="rounded-xl border px-4 py-3 text-sm"
            style={{
              borderColor: 'color-mix(in srgb, #f59e0b 40%, var(--color-border))',
              backgroundColor: 'color-mix(in srgb, #f59e0b 8%, transparent)',
            }}
          >
            This organization&apos;s key could not be opened on this device. Ask an admin to grant you
            access again, or use the owner recovery key below.
          </div>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Name</h2>
          <div className="flex items-end gap-2">
            <TextField
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!can('org:manage')}
              className="flex-1"
            />
            <Button
              onClick={rename}
              disabled={!can('org:manage') || renaming || name.trim() === org.name || name.trim() === ''}
            >
              {renaming ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Your organizations</h2>
          <div className="flex flex-col gap-2">
            {orgs.map((o) => {
              const isPending = o.status === 'pending_key';
              return (
                <div
                  key={o.id}
                  className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
                  style={{
                    borderColor: isPending
                      ? 'color-mix(in srgb, #f59e0b 40%, var(--color-border))'
                      : 'var(--color-border)',
                    backgroundColor: isPending
                      ? 'color-mix(in srgb, #f59e0b 6%, transparent)'
                      : 'var(--color-surface)',
                  }}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: 'var(--color-surface-2)' }}
                    >
                      {isPending ? (
                        <Clock className="h-4 w-4" style={{ color: '#f59e0b' }} />
                      ) : (
                        <Building2 className="h-4 w-4" style={{ color: 'var(--color-brand-500)' }} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{o.name}</p>
                      <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                        {isPending
                          ? `Joined as ${o.role} · waiting for an admin to grant the key`
                          : `${o.member_count} member${o.member_count === 1 ? '' : 's'}`}
                      </p>
                    </div>
                  </div>
                  {isPending ? (
                    <Badge tone="amber">Awaiting key</Badge>
                  ) : (
                    <Badge tone={o.id === orgId ? 'brand' : 'neutral'}>{o.role}</Badge>
                  )}
                </div>
              );
            })}
          </div>

          {pending.length > 0 && (
            <div
              className="mt-2 flex flex-col gap-2 rounded-xl border p-4"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
            >
              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-fg-muted)' }}>
                You are in {pending.length === 1 ? 'that organization' : 'those organizations'}, but
                its secrets stay unreadable until an admin seals the key to this device. They will
                compare a fingerprint for your key first.
              </p>
              <KeyFingerprint
                value={myFingerprint}
                loading={fingerprintLoading}
                label="Your key fingerprint"
                hint="Read these digits to the admin over a call or in person — not over email or chat. If what they see differs, tell them not to grant access."
              />
            </div>
          )}
        </section>

        {can('org:own') && (
          <section className="flex flex-col gap-3">
            <div>
              <h2 className="text-sm font-semibold">Recovery</h2>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                If no device can open this organization any more, its one-time recovery key reopens
                it. Only the owner can do this.
              </p>
            </div>
            <div>
              <Button
                variant="outline"
                icon={<LifeBuoy className="h-4 w-4" />}
                onClick={() => setBreakGlass(true)}
              >
                Recover with organization key
              </Button>
            </div>
          </section>
        )}

        {can('org:own') && (
          <section className="flex flex-col gap-3">
            <div>
              <h2 className="text-sm font-semibold" style={{ color: '#ef4444' }}>
                Danger zone
              </h2>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                Deleting an organization destroys every secret, project, and membership inside it.
                This cannot be undone.
              </p>
            </div>
            <div>
              <Button
                variant="danger"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => setDeleting(true)}
                disabled={orgs.length < 2}
              >
                Delete {org.name}
              </Button>
              {orgs.length < 2 && (
                <p className="mt-2 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                  You need a second organization before you can delete this one.
                </p>
              )}
            </div>
          </section>
        )}
      </div>

      <CreateOrgDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={async (orgName) => {
          const recoveryKey = await createOrg(orgName);
          setCreating(false);
          setNewOrgKey(recoveryKey);
        }}
      />

      <Modal
        open={Boolean(newOrgKey)}
        onClose={() => setNewOrgKey(null)}
        title="Save this organization's recovery key"
        description="Shown once. It is the only way back in if every member device is lost."
        footer={<Button onClick={() => setNewOrgKey(null)}>I&apos;ve saved it</Button>}
      >
        <code
          data-selectable="true"
          className="block rounded-lg border p-3 text-sm"
          style={{
            fontFamily: 'var(--font-mono)',
            backgroundColor: 'var(--color-surface-2)',
            borderColor: 'var(--color-border)',
          }}
        >
          {newOrgKey}
        </code>
      </Modal>

      <BreakGlassDialog open={breakGlass} orgId={orgId} onClose={() => setBreakGlass(false)} />

      <ConfirmDialog
        open={deleting}
        title={`Delete ${org.name}?`}
        message="Every credential, key, project, and env file in this organization is permanently destroyed."
        confirmLabel="Delete forever"
        onCancel={() => setDeleting(false)}
        onConfirm={async () => {
          await orgApi.remove(orgId);
          setDeleting(false);
          await refresh();
          toast.success('Organization deleted');
        }}
      />
    </div>
  );
}

function CreateOrgDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onCreate(name.trim());
      setName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the organization');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New organization"
      description="It gets its own key, so nothing crosses over from your other organizations."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || name.trim() === ''}>
            {busy ? 'Creating…' : 'Create'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme Engineering"
        />
        {error && <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>}
      </div>
    </Modal>
  );
}

function BreakGlassDialog({
  open,
  orgId,
  onClose,
}: {
  open: boolean;
  orgId: string;
  onClose: () => void;
}) {
  const refresh = useOrgs((s) => s.refresh);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      // The server hands back the envelope; unwrapping and re-sealing happen in
      // the Rust core, so the recovery key never leaves this device.
      const envelope = await orgApi.startBreakGlass(orgId);
      const resealed = await crypto.orgRecoveryUnlock(
        orgId,
        key.trim(),
        envelope.org_recovery_salt,
        envelope.org_recovery_wrappedDEK,
      );
      await orgApi.finishBreakGlass(orgId, resealed);
      await refresh();
      setKey('');
      onClose();
      toast.success('Organization unlocked');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recovery failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Recover this organization"
      description="Enter the one-time organization recovery key you saved when it was created."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || key.trim() === ''}>
            {busy ? 'Unlocking…' : 'Unlock'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <TextField
          label="Organization recovery key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
        />
        {error && <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>}
      </div>
    </Modal>
  );
}
