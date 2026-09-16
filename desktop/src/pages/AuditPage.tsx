import { useState } from 'react';
import { ScrollText, Download, Loader2, ShieldCheck, ShieldAlert } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { AuditTable } from '@/components/AuditTable';
import { AuditFilterBar } from '@/components/AuditFilterBar';
import { orgApi, type AuditVerificationDto } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { isFiltered, PAGE_SIZES } from '@/lib/audit-filters';
import { useOrg } from '@/hooks/useOrg';
import { useAuditLog, useMembers } from '@/hooks/team';
import { saveDownload, safeFilename } from '@/lib/native-fs';
import { toast } from '@/stores/toast';

export function AuditPage() {
  const { orgId, org } = useOrg();
  const log = useAuditLog();
  const { members } = useMembers();
  const [integrity, setIntegrity] = useState<AuditVerificationDto | null>(null);
  const [verifying, setVerifying] = useState(false);

  const verify = async () => {
    setVerifying(true);
    try {
      setIntegrity(await orgApi.verifyAudit(orgId!));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not check the trail');
    } finally {
      setVerifying(false);
    }
  };

  const exportCsv = async () => {
    try {
      const csv = await orgApi.exportAudit(orgId!, log.exportParams());
      await saveDownload(safeFilename(`cloak-audit-${org?.name ?? 'org'}`, 'csv'), csv, {
        mime: 'text/csv',
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    }
  };

  const filtered = isFiltered(log.filters);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Audit log"
        description="Who changed what, and when. Metadata only — no secret ever reaches this trail."
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={verifying}
              icon={<ShieldCheck className="h-4 w-4" />}
              onClick={verify}
            >
              {verifying ? 'Checking…' : 'Check integrity'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              icon={<Download className="h-4 w-4" />}
              onClick={exportCsv}
              title={filtered ? 'Exports every entry matching the filters, not just this page' : undefined}
            >
              {filtered ? 'Export filtered CSV' : 'Export CSV'}
            </Button>
          </div>
        }
      />

      {integrity && <IntegrityBanner result={integrity} />}

      <div className="mb-4">
        <AuditFilterBar value={log.filters} onChange={log.setFilters} members={members} />
      </div>

      {log.isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--color-fg-muted)' }} />
        </div>
      ) : log.entries.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={ScrollText}
            title="No entries match these filters"
            description="Widen the time range or clear a filter to see more."
          />
        ) : (
          <EmptyState
            icon={ScrollText}
            title="Nothing recorded yet"
            description="Changes to this organization's vault will appear here as they happen."
          />
        )
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto" style={{ opacity: log.isFetching ? 0.6 : 1 }}>
          <AuditTable entries={log.entries} />
        </div>
      )}

      {log.total > 0 && (
        <div className="mt-4">
          <Pagination
            page={log.page}
            pageCount={log.pageCount}
            pageSize={log.pageSize}
            total={log.total}
            pageSizes={PAGE_SIZES}
            onPageChange={log.setPage}
            onPageSizeChange={log.setPageSize}
            busy={log.isFetching}
          />
        </div>
      )}
    </div>
  );
}

/**
 * The outcome of a chain check.
 *
 * Each entry is hashed together with the hash before it, so an edited or
 * removed row breaks every hash after it. A failure therefore names the point
 * the trail stopped being trustworthy, not just that something is wrong.
 */
function IntegrityBanner({ result }: { result: AuditVerificationDto }) {
  const reasons: Record<string, string> = {
    hash_mismatch: 'an entry was edited after it was written',
    broken_link: 'an entry no longer follows the one before it',
    missing_entry: 'an entry was removed',
  };

  if (result.ok) {
    return (
      <div
        className="mb-4 flex items-start gap-2 rounded-[var(--radius-lg)] border px-4 py-3 text-xs"
        style={{
          backgroundColor: 'color-mix(in srgb, #22c55e 10%, transparent)',
          borderColor: 'color-mix(in srgb, #22c55e 28%, transparent)',
          color: '#22c55e',
        }}
      >
        <ShieldCheck className="h-4 w-4 shrink-0" />
        <span>
          {result.entries_checked} entries verified — every one still hashes to what it claims.
          {result.truncated &&
            ' Entries older than the retention window have expired and cannot be checked.'}
        </span>
      </div>
    );
  }

  return (
    <div
      className="mb-4 flex items-start gap-2 rounded-[var(--radius-lg)] border px-4 py-3 text-xs"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
        borderColor: 'color-mix(in srgb, var(--color-danger) 30%, transparent)',
        color: 'var(--color-danger)',
      }}
    >
      <ShieldAlert className="h-4 w-4 shrink-0" />
      <span>
        This trail has been altered: {reasons[result.broken_at!.reason] ?? 'the chain does not check out'}.
        The first {result.entries_checked} entries are intact; the break is at entry{' '}
        {result.broken_at!.seq}, written {formatDateTime(result.broken_at!.created_at)}. Treat everything
        from there on as unverified.
      </span>
    </div>
  );
}
