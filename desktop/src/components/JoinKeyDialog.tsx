import { useState } from 'react';
import { Check, Copy, Mail, MessageSquareLock } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { CreatedInvitationDto } from '@/lib/api';

/**
 * Hands the join key to the admin who just created it.
 *
 * The key names the server and carries the invitation token, so it is the whole
 * onboarding for the person receiving it — no address to dictate, nothing to
 * type. It is shown here even when the email went out, because on a self-hosted
 * server mail is the part most likely to be unconfigured or silently filtered.
 */
export function JoinKeyDialog({
  invitation,
  onClose,
}: {
  invitation: CreatedInvitationDto | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!invitation) return;
    await navigator.clipboard.writeText(invitation.join_key);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      open={invitation !== null}
      onClose={onClose}
      title={invitation?.emailed ? 'Invitation sent' : 'Invitation ready to send'}
      description={
        invitation?.emailed
          ? `${invitation.email} will receive this join key by email.`
          : `This server has no email provider configured, so nothing was sent. Pass this key to ${invitation?.email} yourself.`
      }
      footer={
        <Button onClick={onClose}>Done</Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <p className="telemetry-label mb-2">Join key</p>
          <div
            className="rounded-[var(--radius-md)] border p-3 text-xs leading-5"
            style={{
              borderColor: 'var(--color-border-soft)',
              backgroundColor: 'var(--color-surface-2)',
              fontFamily: 'var(--font-mono)',
              wordBreak: 'break-all',
            }}
          >
            {invitation?.join_key}
          </div>
          <Button
            className="mt-2 w-full"
            variant="outline"
            size="sm"
            onClick={() => void copy()}
            icon={copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          >
            {copied ? 'Copied' : 'Copy join key'}
          </Button>
        </div>

        <div className="flex flex-col gap-2 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
          <Step icon={invitation?.emailed ? Mail : MessageSquareLock}>
            {invitation?.emailed
              ? 'If it does not arrive, send them the key above over a channel you trust.'
              : 'Send it over a channel you trust. It is addressed to their email and cannot be redeemed by anyone else.'}
          </Step>
          <Step icon={Check}>
            They install Cloak and paste it into the first screen. It points the app at this server
            and redeems the invitation in one step.
          </Step>
          <Step icon={Check}>
            Then come back here and grant them the key. Until you do, they can see the organization
            but read nothing in it.
          </Step>
        </div>
      </div>
    </Modal>
  );
}

function Step({ icon: Icon, children }: { icon: typeof Check; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: 'var(--color-accent)' }} />
      <span className="leading-5">{children}</span>
    </div>
  );
}
