import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  UserPlus,
  Users,
  ShieldCheck,
  KeyRound,
  Loader2,
  UserMinus,
  MailX,
  Crown,
  FileClock,
  BookOpen,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { TextField } from '@/components/ui/TextField';
import { Select } from '@/components/ui/Select';
import { KeyFingerprint } from '@/components/ui/KeyFingerprint';
import { JoinKeyDialog } from '@/components/JoinKeyDialog';
import { useMembers, useInvitations, useFingerprint } from '@/hooks/team';
import { useOrg } from '@/hooks/useOrg';
import { useAuth } from '@/stores/auth';
import { toast } from '@/stores/toast';
import { ROLE_OPTIONS, roleTone, byRole } from '@/lib/roles';
import { formatUtcDate } from '@/lib/utils';
import { RolePermissionsModal } from '@/components/RolePermissionsModal';
import { MemberDetailPage } from './MemberDetailPage';
import type { CreatedInvitationDto, MemberDto, Role } from '@/lib/api';

export function TeamPage() {
  const { org, role, can } = useOrg();
  const myEmail = useAuth((s) => s.email);
  const { members, isLoading, grant, changeRole, remove, transfer } = useMembers();
  const { invitations, invite, revoke } = useInvitations();
  // Held so the join key can be handed over after the dialog closes; it is
  // returned once and never again by the listing endpoint.
  const [sentInvite, setSentInvite] = useState<CreatedInvitationDto | null>(null);

  const [viewing, setViewing] = useState<string | null>(null);
  const [showingRoles, setShowingRoles] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [granting, setGranting] = useState<MemberDto | null>(null);
  const [removing, setRemoving] = useState<MemberDto | null>(null);
  const [promoting, setPromoting] = useState<MemberDto | null>(null);

  const pending = members.filter((m) => m.status === 'pending_key');
  const active = members.filter((m) => m.status === 'active');
  const openInvites = invitations.filter((i) => i.status === 'pending');

  const isMe = (m: MemberDto) => m.email.toLowerCase() === myEmail?.toLowerCase();
  const me = active.find(isMe);
  const others = active.filter((m) => !isMe(m)).sort(byRole);

  if (viewing) {
    return <MemberDetailPage userId={viewing} onBack={() => setViewing(null)} />;
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <PageHeader
        title="Team"
        description={
          org
            ? `${active.length} member${active.length === 1 ? '' : 's'} in ${org.name}. Everyone here can decrypt this organization's secrets.`
            : 'Manage who can open this organization.'
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              icon={<BookOpen className="h-4 w-4" />}
              onClick={() => setShowingRoles(true)}
            >
              How roles work
            </Button>
            {can('member:manage') && (
              <Button icon={<UserPlus className="h-4 w-4" />} size="sm" onClick={() => setInviting(true)}>
                Invite
              </Button>
            )}
          </>
        }
      />

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--color-fg-muted)' }} />
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {pending.length > 0 && can('member:manage') && (
            <section className="flex flex-col gap-3">
              <div>
                <h2 className="text-sm font-semibold">Waiting for a key</h2>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                  They accepted the invitation but cannot read anything yet. Neither we nor they can
                  produce the key — you have to seal it to them from this device.
                </p>
              </div>
              {pending.map((member) => (
                <PendingRow key={member.user_id} member={member} onGrant={() => setGranting(member)} />
              ))}
            </section>
          )}

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold">Members</h2>
            {active.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No members yet"
                description="Invite a teammate to share this organization's secrets with them."
              />
            ) : (
              <div className="flex flex-col gap-2">
                {me && (
                  <MemberRow
                    key={me.user_id}
                    member={me}
                    isSelf
                    canManage={false}
                    canTransfer={false}
                    canInspect={can('audit:read')}
                    onInspect={() => setViewing(me.user_id)}
                    onRoleChange={async () => {}}
                    onRemove={() => setRemoving(me)}
                    onPromote={() => setPromoting(me)}
                  />
                )}

                {me && others.length > 0 && (
                  <div className="mt-3 flex items-center gap-3">
                    <span className="telemetry-label shrink-0">Other members</span>
                    <span className="h-px flex-1" style={{ backgroundColor: 'var(--color-border)' }} />
                  </div>
                )}

                {others.map((member) => (
                  <MemberRow
                    key={member.user_id}
                    member={member}
                    canManage={can('member:manage') && member.role !== 'owner'}
                    canTransfer={role === 'owner' && member.role !== 'owner'}
                    canInspect={can('audit:read')}
                    onInspect={() => setViewing(member.user_id)}
                    onRoleChange={async (next) => {
                      await changeRole(member.user_id, next);
                      toast.success(`${member.name ?? member.email} is now ${next}`);
                    }}
                    onRemove={() => setRemoving(member)}
                    onPromote={() => setPromoting(member)}
                  />
                ))}
              </div>
            )}
          </section>

          {can('member:manage') && openInvites.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold">Pending invitations</h2>
              <div className="flex flex-col gap-2">
                {openInvites.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{invitation.email}</p>
                      <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                        Invited as {invitation.role} · expires{' '}
                        {formatUtcDate(invitation.expires_at)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<MailX className="h-4 w-4" />}
                      onClick={async () => {
                        await revoke(invitation.id);
                        toast.success('Invitation revoked');
                      }}
                    >
                      Revoke
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <RolePermissionsModal open={showingRoles} onClose={() => setShowingRoles(false)} />

      <InviteForm
        open={inviting}
        onClose={() => setInviting(false)}
        onSubmit={async (email, role) => {
          const created = await invite(email, role);
          setInviting(false);
          setSentInvite(created);
        }}
      />

      <JoinKeyDialog invitation={sentInvite} onClose={() => setSentInvite(null)} />

      <GrantDialog
        member={granting}
        onClose={() => setGranting(null)}
        onConfirm={async (member) => {
          await grant(member.user_id, member.identity_public_key!);
          setGranting(null);
          toast.success(`${member.email} can now open this vault`);
        }}
      />

      <ConfirmDialog
        open={Boolean(removing)}
        title={`Remove ${removing?.email ?? ''}?`}
        message="They lose access immediately. Note that this does not rotate the organization's key, so anything they already copied stays readable to them."
        confirmLabel="Remove"
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          await remove(removing.user_id);
          setRemoving(null);
          toast.success('Member removed');
        }}
      />

      <ConfirmDialog
        open={Boolean(promoting)}
        title={`Make ${promoting?.email ?? ''} the owner?`}
        message="They gain full control of this organization, including deleting it. You stay on as an admin."
        confirmLabel="Transfer ownership"
        onCancel={() => setPromoting(null)}
        onConfirm={async () => {
          if (!promoting) return;
          await transfer(promoting.user_id);
          setPromoting(null);
          toast.success('Ownership transferred');
        }}
      />
    </div>
  );
}

function PendingRow({ member, onGrant }: { member: MemberDto; onGrant: () => void }) {
  const { data: fingerprint, isLoading } = useFingerprint(member.identity_public_key);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-3 rounded-xl border px-4 py-3"
      style={{
        borderColor: 'color-mix(in srgb, #f59e0b 40%, var(--color-border))',
        backgroundColor: 'color-mix(in srgb, #f59e0b 6%, transparent)',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{member.name ?? member.email}</p>
          <p className="truncate text-xs" style={{ color: 'var(--color-fg-muted)' }}>
            {member.name ? `${member.email} · ` : ''}Accepted as {member.role} · no key yet
          </p>
        </div>
        <Button size="sm" icon={<KeyRound className="h-4 w-4" />} onClick={onGrant}>
          Grant access
        </Button>
      </div>

      <KeyFingerprint
        value={fingerprint}
        loading={isLoading}
        label="Their key fingerprint"
        hint="Ask them to read this back from their own Settings screen, over a call or in person. Matching digits are the only thing that proves the key really is theirs."
      />
    </motion.div>
  );
}

function MemberRow({
  member,
  isSelf = false,
  canManage,
  canTransfer,
  canInspect,
  onInspect,
  onRoleChange,
  onRemove,
  onPromote,
}: {
  member: MemberDto;
  isSelf?: boolean;
  canManage: boolean;
  canTransfer: boolean;
  canInspect: boolean;
  onInspect: () => void;
  onRoleChange: (role: Exclude<Role, 'owner'>) => Promise<void>;
  onRemove: () => void;
  onPromote: () => void;
}) {
  const label = member.name ?? member.email;
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: 'var(--color-surface-2)' }}
        >
          <ShieldCheck className="h-4 w-4" style={{ color: 'var(--color-brand-500)' }} />
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium">
            <span className="truncate">{label}</span>
            {isSelf && <Badge tone="brand">You</Badge>}
          </p>
          <p className="truncate text-xs" style={{ color: 'var(--color-fg-muted)' }}>
            {member.name ? `${member.email} · ` : ''}
            {member.joined_at ? `Joined ${formatUtcDate(member.joined_at)}` : 'Founding member'}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {canInspect && (
          <Button
            variant="ghost"
            size="sm"
            icon={<FileClock className="h-4 w-4" />}
            onClick={onInspect}
            title={`Open ${label}'s details and activity`}
            aria-label={`Open details for ${label}`}
          />
        )}
        {canManage ? (
          <Select
            value={member.role}
            onChange={(v) => void onRoleChange(v as Exclude<Role, 'owner'>)}
            options={ROLE_OPTIONS}
            className="w-60"
          />
        ) : (
          <Badge tone={roleTone[member.role]}>{member.role}</Badge>
        )}
        {canTransfer && (
          <Button
            variant="ghost"
            size="sm"
            icon={<Crown className="h-4 w-4" />}
            onClick={onPromote}
            title={`Make ${label} the owner`}
            aria-label={`Transfer ownership to ${label}`}
          />
        )}
        {canManage && (
          <Button
            variant="ghost"
            size="sm"
            icon={<UserMinus className="h-4 w-4" />}
            onClick={onRemove}
            title={`Remove ${label} from this organization`}
            aria-label={`Remove ${label}`}
          />
        )}
      </div>
    </div>
  );
}

function InviteForm({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (email: string, role: Exclude<Role, 'owner'>) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Exclude<Role, 'owner'>>('member');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(email.trim(), role);
      setEmail('');
      setRole('member');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the invitation');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite to this organization"
      description="They will need to accept, and then you grant them the key from this device."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || email.trim().length === 0}>
            {busy ? 'Sending…' : 'Send invitation'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <TextField
          label="Email address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@company.com"
        />
        <Select
          label="Role"
          value={role}
          onChange={(v) => setRole(v as Exclude<Role, 'owner'>)}
          options={ROLE_OPTIONS}
        />
        {error && <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>}
      </div>
    </Modal>
  );
}

function GrantDialog({
  member,
  onClose,
  onConfirm,
}: {
  member: MemberDto | null;
  onClose: () => void;
  onConfirm: (member: MemberDto) => Promise<void>;
}) {
  const { data: fingerprint, isLoading } = useFingerprint(member?.identity_public_key);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (!member) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(member);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not grant access');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={Boolean(member)}
      onClose={onClose}
      title="Grant vault access"
      description={`This seals the organization's key to ${member?.email ?? ''} so they can decrypt its secrets.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={busy || !member?.identity_public_key}>
            {busy ? 'Granting…' : 'Grant access'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <KeyFingerprint
          value={fingerprint}
          loading={isLoading}
          label="Their key fingerprint"
        />
        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-fg-muted)' }}>
          Have them open Settings on their own device and read their fingerprint back to you, over a
          call or in person — not over email or chat. We can only show you the key the server says is
          theirs, so this comparison is the one step that would catch a substituted one.
        </p>
        <p className="text-xs leading-relaxed" style={{ color: '#f59e0b' }}>
          If the digits differ, cancel. Granting would hand this organization&apos;s secrets to
          whoever holds the other key.
        </p>
        {error && <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>}
      </div>
    </Modal>
  );
}
