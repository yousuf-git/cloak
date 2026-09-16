import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { auditParams, NO_FILTERS, PAGE_SIZES, type AuditFilters } from '@/lib/audit-filters';
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

/**
 * One page of the audit trail, with the filters and page state that pick it.
 * Pass `userId` for a single member's activity; the member filter is then fixed
 * to them.
 */
export function useAuditLog({ userId }: { userId?: string } = {}) {
  const sandbox = useAppMode((s) => s.sandbox);
  const { orgId, can } = useOrg();
  const [filters, setFilters] = useState<AuditFilters>(NO_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);

  const scoped = userId ? { ...filters, userId } : filters;
  const query = useQuery({
    queryKey: ['audit', orgId, scoped, page, pageSize],
    // Date.now() is read here, per request, so "last 24 hours" means the day
    // before the page was asked for rather than before the filter was picked.
    queryFn: () =>
      orgApi.listAudit(orgId!, {
        ...auditParams(scoped, Date.now()),
        page: String(page),
        limit: String(pageSize),
      }),
    enabled: !sandbox && Boolean(orgId) && can('audit:read'),
    // Keep the current rows on screen while the next page loads, instead of
    // collapsing the table to a spinner on every click.
    placeholderData: keepPreviousData,
  });

  const pageCount = query.data?.page_count ?? 0;
  // A narrower filter, or bigger pages, can leave the current page past the end.
  useEffect(() => {
    if (pageCount > 0 && page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  return {
    entries: query.data?.entries ?? [],
    total: query.data?.total ?? 0,
    pageCount,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    filters,
    setFilters: (next: AuditFilters) => {
      setFilters(next);
      setPage(1);
    },
    page,
    setPage,
    pageSize,
    setPageSize: (next: number) => {
      setPageSize(next);
      setPage(1);
    },
    /** The same filters, for an export of what is on screen (every page of it). */
    exportParams: () => auditParams(scoped, Date.now()),
  };
}
