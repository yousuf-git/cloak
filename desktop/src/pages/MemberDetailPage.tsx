import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Crown,
  Loader2,
  Mail,
  ScrollText,
  ShieldCheck,
  UserMinus,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Select } from '@/components/ui/Select';
import { KeyFingerprint } from '@/components/ui/KeyFingerprint';
import { useMember, useMemberActivity, useMembers, useFingerprint } from '@/hooks/team';
import { useOrg } from '@/hooks/useOrg';
import { toast } from '@/stores/toast';
import { formatUtc, timeAgo } from '@/lib/utils';
import type { MemberRefDto, Role } from '@/lib/api';
import { ROLE_OPTIONS, roleTone } from '@/lib/roles';

/**
 * One member, in full: how they got in, who let them in, and everything they
 * have done in this organization. Reached only from the team list.
 */
export function MemberDetailPage({ userId, onBack }: { userId: string; onBack: () => void }) {
  const { role, can } = useOrg();
  const { data: member, isLoading } = useMember(userId);
  const { changeRole, remove, transfer } = useMembers();
  const { data: fingerprint, isLoading: fingerprintLoading } = useFingerprint(
    member?.identity_public_key,
  );

  const [cursors, setCursors] = useState<string[]>([]);
  const activity = useMemberActivity(userId, cursors.at(-1));

  const [removing, setRemoving] = useState(false);
  const [promoting, setPromoting] = useState(false);

  const canManage = can('member:manage') && member?.role !== 'owner';
  const canTransfer = role === 'owner' && member?.role !== 'owner';
  const entries = activity.data?.entries ?? [];

  if (isLoading || !member) {
    return (
      <div className="flex h-full flex-col">
        <BackButton onBack={onBack} />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--color-fg-muted)' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <BackButton onBack={onBack} />

      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="dashboard-card mb-6 rounded-[var(--radius-xl)] p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: 'var(--color-surface-2)' }}
            >
              <ShieldCheck className="h-5 w-5" style={{ color: 'var(--color-brand-500)' }} />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight">
                {member.name ?? member.email}
              </h1>
              <p className="flex items-center gap-1.5 truncate text-sm" style={{ color: 'var(--color-fg-muted)' }}>
                <Mail className="h-3.5 w-3.5 shrink-0" />
                {member.email}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {canManage ? (
              <Select
                value={member.role}
                onChange={async (next) => {
                  await changeRole(member.user_id, next as Exclude<Role, 'owner'>);
                  toast.success(`${member.name ?? member.email} is now ${next}`);
                }}
                options={ROLE_OPTIONS}
                className="w-60"
              />
            ) : (
              <Badge tone={roleTone[member.role]}>{member.role}</Badge>
            )}
            {canTransfer && (
              <Button
                variant="outline"
                size="sm"
                icon={<Crown className="h-4 w-4" />}
                onClick={() => setPromoting(true)}
              >
                Make owner
              </Button>
            )}
            {canManage && (
              <Button
                variant="outline"
                size="sm"
                icon={<UserMinus className="h-4 w-4" />}
                onClick={() => setRemoving(true)}
              >
                Remove
              </Button>
            )}
          </div>
        </div>

        {/* The actor and the moment belong together: "who let them in, and
            when" is one fact, not two scattered across the row. */}
        <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Status">
            {member.status === 'active' ? (
              <Badge tone="green">Active</Badge>
            ) : (
              <Badge tone="amber">Awaiting key</Badge>
            )}
          </Fact>
          <Fact label="Invited by" at={member.invited_at}>
            {person(member.invited_by) ?? 'Founding member'}
          </Fact>
          <Fact label="Joined">{formatUtc(member.joined_at)}</Fact>
          <Fact label="Access granted by" at={member.granted_at}>
            {person(member.granted_by) ??
              (member.status === 'pending_key'
                ? 'Not yet'
                : member.role === 'owner'
                  ? 'Self (org creator)'
                  : 'Not recorded')}
          </Fact>
          <Fact label="Last activity" at={member.last_activity_at}>
            {member.last_activity_at ? timeAgo(member.last_activity_at) : 'No activity yet'}
          </Fact>
        </dl>

        {member.identity_public_key && (
          <div className="mt-5 max-w-xl">
            <KeyFingerprint
              value={fingerprint}
              loading={fingerprintLoading}
              label="Their key fingerprint"
            />
          </div>
        )}
      </motion.section>

      <h2 className="mb-3 text-sm font-semibold">Activity</h2>

      {!can('audit:read') ? (
        <EmptyState
          icon={ScrollText}
          title="Activity is admin-only"
          description="Ask an admin if you need this member's audit trail."
        />
      ) : activity.isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--color-fg-muted)' }} />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="Nothing recorded yet"
          description="Anything this member changes in the vault will show up here."
        />
      ) : (
        <>
          <div className="min-h-0 overflow-x-auto">
            {/* No "who" column: every row here is already this one member. */}
            <table className="w-full text-left text-sm">
              <thead
                className="text-[11px] uppercase tracking-wide"
                style={{ color: 'var(--color-fg-muted)' }}
              >
                <tr>
                  <th className="py-2 pr-4 font-medium">When</th>
                  <th className="py-2 pr-4 font-medium">Action</th>
                  <th className="py-2 pr-4 font-medium">Resource</th>
                  <th className="py-2 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="whitespace-nowrap py-2 pr-4 tabular-nums" style={{ color: 'var(--color-fg-muted)' }}>
                      {formatUtc(entry.created_at)}
                    </td>
                    <td className="py-2 pr-4">
                      <code className="text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
                        {entry.action}
                      </code>
                    </td>
                    <td className="py-2 pr-4" style={{ color: 'var(--color-fg-muted)' }}>
                      {entry.resource ?? '—'}
                    </td>
                    <td className="py-2" style={{ color: 'var(--color-fg-muted)' }}>
                      {entry.ip ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <Button
              size="sm"
              variant="ghost"
              disabled={cursors.length === 0}
              onClick={() => setCursors((c) => c.slice(0, -1))}
            >
              Newer
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={!activity.data?.next_cursor}
              onClick={() => setCursors((c) => [...c, activity.data!.next_cursor!])}
            >
              Older
            </Button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={removing}
        title={`Remove ${member.name ?? member.email}?`}
        message="They lose access immediately. Note that this does not rotate the organization's key, so anything they already copied stays readable to them."
        confirmLabel="Remove"
        onCancel={() => setRemoving(false)}
        onConfirm={async () => {
          await remove(member.user_id);
          setRemoving(false);
          toast.success('Member removed');
          onBack();
        }}
      />

      <ConfirmDialog
        open={promoting}
        title={`Make ${member.name ?? member.email} the owner?`}
        message="They gain full control of this organization, including deleting it. You stay on as an admin."
        confirmLabel="Transfer ownership"
        onCancel={() => setPromoting(false)}
        onConfirm={async () => {
          await transfer(member.user_id);
          setPromoting(false);
          toast.success('Ownership transferred');
        }}
      />
    </div>
  );
}

function person(ref?: MemberRefDto): string | null {
  if (!ref) return null;
  return ref.name ?? ref.email;
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      onClick={onBack}
      className="no-drag mb-4 inline-flex w-fit items-center gap-2 text-xs transition-transform hover:-translate-x-0.5"
      style={{ color: 'var(--color-fg-muted)' }}
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Back to team
    </button>
  );
}

function Fact({
  label,
  at,
  children,
}: {
  label: string;
  /** Timestamp for the event this fact describes, shown beneath the actor. */
  at?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="telemetry-label">{label}</dt>
      <dd className="mt-1 truncate text-sm">{children}</dd>
      {at && (
        <dd className="mt-0.5 truncate text-xs tabular-nums" style={{ color: 'var(--color-fg-muted)' }}>
          {formatUtc(at)}
        </dd>
      )}
    </div>
  );
}
