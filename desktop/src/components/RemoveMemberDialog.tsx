import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, KeyRound, FileCode, Terminal, Ticket, Server, Eye } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { orgApi, type ExposedKind } from '@/lib/api';

/** Both the team list and the member detail page open this, with different shapes. */
interface RemovableMember {
  user_id: string;
  email: string;
}

const KIND_LABELS: Record<ExposedKind, string> = {
  cred: 'Credential',
  api_key: 'API key',
  access_key: 'Access key',
  ssh_key: 'SSH key',
  platform: 'Backup codes',
  env_file: 'Env file',
};

const KIND_ICONS: Record<ExposedKind, typeof KeyRound> = {
  cred: KeyRound,
  api_key: Ticket,
  access_key: Server,
  ssh_key: Terminal,
  platform: KeyRound,
  env_file: FileCode,
};

/**
 * Removal, with the rotation list in front of the admin while they decide.
 *
 * A member holds the organization's key, so everything in it was readable to
 * them for as long as they were in the team. That is what membership means —
 * the useful thing to show at this moment is which secrets to change, and where
 * to change them.
 */
export function RemoveMemberDialog({
  member,
  orgId,
  onClose,
  onConfirm,
}: {
  member: RemovableMember | null;
  orgId: string;
  onClose: () => void;
  onConfirm: (member: RemovableMember) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  const query = useQuery({
    queryKey: ['member-exposure', orgId, member?.user_id],
    queryFn: () => orgApi.memberExposure(orgId, member!.user_id),
    enabled: Boolean(member),
  });

  const exposure = query.data;
  const total = exposure ? Object.values(exposure.counts).reduce((sum, n) => sum + n, 0) : 0;

  const run = async () => {
    if (!member) return;
    setBusy(true);
    try {
      await onConfirm(member);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={Boolean(member)}
      onClose={onClose}
      title={`Remove ${member?.email ?? ''}?`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={run} disabled={busy}>
            {busy ? 'Removing…' : 'Remove member'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <p className="text-sm" style={{ color: 'var(--color-fg-muted)' }}>
          They lose access to this organization the moment you confirm, on every device.
        </p>

        {query.isLoading ? (
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-fg-muted)' }}>
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking what they had access to…
          </div>
        ) : total === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-fg-muted)' }}>
            This organization holds no secrets yet, so there is nothing to change afterwards.
          </p>
        ) : (
          <>
            <div
              className="rounded-[var(--radius-lg)] border p-3 text-sm"
              style={{
                backgroundColor: 'var(--color-surface-2)',
                borderColor: 'var(--color-border-soft)',
              }}
            >
              <p className="font-medium">Change these where they were issued</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                As a member of this organization they could open all {total} of the secrets below,
                and may have kept their own copies. A secret that has been read cannot be un-read,
                so rotate these at the provider that issued them — Stripe, AWS, your server — and
                save the new values here.
                {exposure!.opened_count > 0 && (
                  <>
                    {' '}
                    The {exposure!.opened_count} marked <em>opened</em> are the ones the audit trail
                    shows they actually used. Start there.
                  </>
                )}
              </p>
            </div>

            <div
              className="max-h-64 overflow-y-auto rounded-[var(--radius-lg)] border"
              style={{ borderColor: 'var(--color-border-soft)' }}
            >
              {exposure!.items.map((item) => {
                const Icon = KIND_ICONS[item.kind];
                return (
                  <div
                    key={`${item.kind}-${item.id}`}
                    className="flex items-center gap-3 border-b px-3 py-2 last:border-b-0"
                    style={{ borderColor: 'var(--color-border-soft)' }}
                  >
                    <Icon className="h-4 w-4 shrink-0" style={{ color: 'var(--color-fg-muted)' }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{item.label}</p>
                      <p className="text-[11px]" style={{ color: 'var(--color-fg-muted)' }}>
                        {KIND_LABELS[item.kind]}
                        {item.project && ` · ${item.project}`}
                      </p>
                    </div>
                    {item.opened && (
                      <Badge tone="amber">
                        <Eye className="mr-1 inline h-3 w-3" />
                        opened
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>

            {exposure!.truncated && (
              <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                Showing the first {exposure!.items.length} of {total}. Export the audit log for the
                full picture.
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
