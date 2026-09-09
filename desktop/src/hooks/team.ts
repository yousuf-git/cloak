import { useQuery, useQueryClient } from '@tanstack/react-query';
import { orgApi, type MemberDto, type Role } from '@/lib/api';
import { crypto } from '@/lib/tauri-crypto';
import { useOrg } from '@/hooks/useOrg';
import { useOrgs } from '@/stores/org';
import { useAppMode } from '@/stores/app-mode';

export function useMembers() {
  const sandbox = useAppMode((s) => s.sandbox);
  const { orgId } = useOrg();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['members', orgId],
    queryFn: () => orgApi.listMembers(orgId!),
    enabled: !sandbox && Boolean(orgId),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['members', orgId] });

  return {
    members: query.data ?? [],
    isLoading: query.isLoading,

    /**
     * Seal this org's DEK to a joining member's public key. Runs entirely in the
     * Rust core — the key never reaches the server or this webview.
     */
    grant: async (userId: string, publicKey: string) => {
      const sealed = await crypto.sealOrgDekFor(orgId!, publicKey);
      await orgApi.grantKey(orgId!, userId, sealed);
      // Move the row out of "waiting for a key" as soon as the server confirms,
      // rather than leaving it there for the length of a refetch. The server
      // has already flipped the status; this just stops the list disagreeing
      // with it. The refetch below reconciles the fields we do not know here.
      qc.setQueryData<MemberDto[]>(['members', orgId], (prev) =>
        prev?.map((m) => (m.user_id === userId ? { ...m, status: 'active' } : m)),
      );
      void invalidate();
    },
    changeRole: async (userId: string, role: Exclude<Role, 'owner'>) => {
      await orgApi.changeRole(orgId!, userId, role);
      await invalidate();
    },
    remove: async (userId: string) => {
      await orgApi.removeMember(orgId!, userId);
      await invalidate();
    },
    transfer: async (userId: string) => {
      await orgApi.transfer(orgId!, userId);
      await invalidate();
    },
  };
}

export function useInvitations() {
  const sandbox = useAppMode((s) => s.sandbox);
  const { orgId, can } = useOrg();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['invitations', orgId],
    queryFn: () => orgApi.listInvitations(orgId!),
    enabled: !sandbox && Boolean(orgId) && can('member:manage'),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['invitations', orgId] });

  return {
    invitations: query.data ?? [],
    isLoading: query.isLoading,
    // Returns the created invitation, join key included: the admin needs it in
    // hand for the case where the server has no mail provider configured.
    invite: async (email: string, role: Exclude<Role, 'owner'>) => {
      const created = await orgApi.invite(orgId!, email, role);
      await invalidate();
      return created;
    },
    revoke: async (invitationId: string) => {
      await orgApi.revokeInvitation(orgId!, invitationId);
      await invalidate();
    },
  };
}

/** Digest of a member's public key, for out-of-band verification. */
export function useFingerprint(publicKey?: string) {
  return useQuery({
    queryKey: ['fingerprint', publicKey],
    queryFn: () => crypto.publicKeyFingerprint(publicKey!),
    enabled: Boolean(publicKey),
    staleTime: Infinity,
  });
}

/**
 * This device's own fingerprint — the half of the comparison a joining member
 * reads back to the admin who is about to grant them the key.
 */
export function useMyFingerprint() {
  const publicKey = useOrgs((s) => s.identityPublicKey);
  return useFingerprint(publicKey ?? undefined);
}

/** One member's full record, for the detail page reached from the team list. */
export function useMember(userId?: string) {
  const sandbox = useAppMode((s) => s.sandbox);
  const { orgId } = useOrg();

  return useQuery({
    queryKey: ['member', orgId, userId],
    queryFn: () => orgApi.getMember(orgId!, userId!),
    enabled: !sandbox && Boolean(orgId) && Boolean(userId),
  });
}

/** That member's own audit trail — the "who" column is implied, so it is dropped. */
export function useMemberActivity(userId?: string, cursor?: string) {
  const sandbox = useAppMode((s) => s.sandbox);
  const { orgId, can } = useOrg();

  return useQuery({
    queryKey: ['member-activity', orgId, userId, cursor ?? 'first'],
    queryFn: () =>
      orgApi.listAudit(orgId!, { user_id: userId!, ...(cursor ? { cursor } : {}) }),
    enabled: !sandbox && Boolean(orgId) && Boolean(userId) && can('audit:read'),
  });
}
