import { useEffect, useState } from 'react';
import { Mailbox, Loader2, KeyRound } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { KeyFingerprint } from '@/components/ui/KeyFingerprint';
import { useMyFingerprint } from '@/hooks/team';
import { orgApi } from '@/lib/api';
import { useOrgs } from '@/stores/org';
import { toast } from '@/stores/toast';

interface Preview {
  org_name: string;
  role: string;
  invited_by_email: string;
}

interface Joined {
  org_name: string;
}

/**
 * Redeem an invitation code from an email. Accepting only creates the
 * membership — the vault stays unreadable until an admin grants the key, so the
 * copy says so plainly rather than implying instant access.
 */
export function InviteAccept({
  open,
  initialToken,
  onClose,
}: {
  open: boolean;
  /** Pre-filled when the user arrived from a join key rather than typing a code. */
  initialToken?: string | null;
  onClose: () => void;
}) {
  const refresh = useOrgs((s) => s.refresh);
  const { data: myFingerprint, isLoading: fingerprintLoading } = useMyFingerprint();
  const [token, setToken] = useState(initialToken ?? '');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [joined, setJoined] = useState<Joined | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The token arrives after this component has mounted, so it is synced rather
  // than only seeded: the join key is decoded during onboarding, well before
  // the shell that renders this dialog exists.
  useEffect(() => {
    if (initialToken) setToken(initialToken);
  }, [initialToken]);

  const reset = () => {
    setToken('');
    setPreview(null);
    setJoined(null);
    setError(null);
    onClose();
  };

  const look = async () => {
    setBusy(true);
    setError(null);
    try {
      setPreview(await orgApi.peekInvitation(token.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That invitation code is not valid');
    } finally {
      setBusy(false);
    }
  };

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await orgApi.acceptInvitation(token.trim());
      await refresh();
      // Hold the dialog open on a waiting state: this is the moment the joiner
      // needs their own fingerprint, because the admin is about to compare it.
      setJoined({ org_name: result.org_name });
      setPreview(null);
      setToken('');
      toast.success(`Joined ${result.org_name}. An admin still has to grant you the key.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept the invitation');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={reset}
      title="Join an organization"
      description="Paste the invitation code from your email."
      footer={
        joined ? (
          <Button onClick={reset}>Done</Button>
        ) : (
        <>
          <Button variant="ghost" onClick={reset}>
            Cancel
          </Button>
          {preview ? (
            <Button onClick={accept} disabled={busy}>
              {busy ? 'Joining…' : `Join ${preview.org_name}`}
            </Button>
          ) : (
            <Button onClick={look} disabled={busy || token.trim() === ''}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continue'}
            </Button>
          )}
        </>
        )
      }
    >
      {joined ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" style={{ color: '#f59e0b' }} />
            <p className="text-sm font-medium">Waiting for {joined.org_name} to grant you the key</p>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-fg-muted)' }}>
            You are in the organization, but its secrets stay unreadable until an admin seals the
            key to your device. Before they do, they will see a fingerprint for your key and should
            check it against yours.
          </p>
          <KeyFingerprint
            value={myFingerprint}
            loading={fingerprintLoading}
            label="Your key fingerprint"
            hint="Read these digits to the admin over a call or in person — not over email or chat. If what they see differs, tell them not to grant access: someone has swapped the key."
          />
          <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
            You can find this again any time under Settings.
          </p>
        </div>
      ) : (
      <div className="flex flex-col gap-3">
        <TextField
          label="Invitation code"
          value={token}
          onChange={(e) => {
            setToken(e.target.value);
            setPreview(null);
          }}
          icon={<Mailbox className="h-4 w-4" />}
        />

        {preview && (
          <div
            className="flex flex-col gap-1 rounded-lg border p-3 text-sm"
            style={{ backgroundColor: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}
          >
            <span className="font-medium">{preview.org_name}</span>
            <span className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
              Invited by {preview.invited_by_email} as {preview.role}
            </span>
            <span className="mt-1 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
              After you join, an admin has to seal the organization&apos;s key to your device before
              you can read anything. That handoff is what keeps these secrets unreadable to our
              servers.
            </span>
          </div>
        )}

        {error && <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>}
      </div>
      )}
    </Modal>
  );
}
