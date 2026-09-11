import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText, Download, Loader2, ShieldCheck, ShieldAlert } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { TextField } from '@/components/ui/TextField';
import { orgApi, type AuditEntryDto, type AuditVerificationDto } from '@/lib/api';
import { formatUtc } from '@/lib/utils';
import { useOrg } from '@/hooks/useOrg';
import { saveDownload, safeFilename } from '@/lib/native-fs';
import { toast } from '@/stores/toast';

export function AuditPage() {
  const { orgId, org } = useOrg();
  const [action, setAction] = useState('');
  const [failuresOnly, setFailuresOnly] = useState(false);
  const [cursors, setCursors] = useState<string[]>([]);
  const [integrity, setIntegrity] = useState<AuditVerificationDto | null>(null);
  const [verifying, setVerifying] = useState(false);
  const cursor = cursors.at(-1);

  const query = useQuery({
    queryKey: ['audit', orgId, action, failuresOnly, cursor ?? 'first'],
    queryFn: () =>
      orgApi.listAudit(orgId!, {
        ...(action ? { action } : {}),
        ...(failuresOnly ? { outcome: 'failure' } : {}),
        ...(cursor ? { cursor } : {}),
      }),
    enabled: Boolean(orgId),
  });

  const entries = query.data?.entries ?? [];

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
      const csv = await orgApi.exportAudit(orgId!);
      await saveDownload(safeFilename(`cloak-audit-${org?.name ?? 'org'}`, 'csv'), csv, {
        mime: 'text/csv',
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    }
  };

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
            <Button size="sm" variant="outline" icon={<Download className="h-4 w-4" />} onClick={exportCsv}>
              Export CSV
            </Button>
          </div>
        }
      />

      {integrity && <IntegrityBanner result={integrity} />}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="max-w-xs flex-1">
          <TextField
            placeholder="Filter by action, e.g. env:view"
            value={action}
            onChange={(e) => {
              setAction(e.target.value.trim());
              setCursors([]);
            }}
          />
        </div>
        <Button
          size="sm"
          variant={failuresOnly ? 'outline' : 'ghost'}
          onClick={() => {
            setFailuresOnly((v) => !v);
            setCursors([]);
          }}
        >
          Failures only
        </Button>
      </div>

      {query.isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--color-fg-muted)' }} />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="Nothing recorded yet"
          description="Changes to this organization's vault will appear here as they happen."
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead
              className="sticky top-0 text-[11px] uppercase tracking-wide"
              style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-fg-muted)' }}
            >
              <tr>
                <th className="py-2 pr-4 font-medium">When</th>
                <th className="py-2 pr-4 font-medium">Action</th>
                <th className="py-2 pr-4 font-medium">Who</th>
                <th className="py-2 pr-4 font-medium">What</th>
                <th className="py-2 pr-4 font-medium">Details</th>
                <th className="py-2 font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-t align-top" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="whitespace-nowrap py-2 pr-4 tabular-nums" style={{ color: 'var(--color-fg-muted)' }}>
                    {formatUtc(entry.created_at)}
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <code className="text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
                        {entry.action}
                      </code>
                      {entry.outcome === 'failure' && <Badge tone="red">failed</Badge>}
                    </div>
                  </td>
                  <td className="py-2 pr-4">{entry.actor_email ?? '—'}</td>
                  <td className="py-2 pr-4">
                    {entry.target_label ? (
                      <>
                        <span className="font-medium">{entry.target_label}</span>
                        {entry.resource && (
                          <span className="block text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                            {entry.resource}
                          </span>
                        )}
                      </>
                    ) : (
                      <span style={{ color: 'var(--color-fg-muted)' }}>{entry.resource ?? '—'}</span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                    {describe(entry)}
                  </td>
                  <td className="py-2" style={{ color: 'var(--color-fg-muted)' }}>
                    {entry.ip ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
          disabled={!query.data?.next_cursor}
          onClick={() => setCursors((c) => [...c, query.data!.next_cursor!])}
        >
          Older
        </Button>
      </div>
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
        backgroundColor: 'color-mix(in srgb, #ef4444 10%, transparent)',
        borderColor: 'color-mix(in srgb, #ef4444 30%, transparent)',
        color: '#ef4444',
      }}
    >
      <ShieldAlert className="h-4 w-4 shrink-0" />
      <span>
        This trail has been altered: {reasons[result.broken_at!.reason] ?? 'the chain does not check out'}.
        The first {result.entries_checked} entries are intact; the break is at entry{' '}
        {result.broken_at!.seq}, written {formatUtc(result.broken_at!.created_at)}. Treat everything
        from there on as unverified.
      </span>
    </div>
  );
}

/**
 * The context of an entry, in words. The server already renders a flat
 * `detail` string for the CSV; the cases here are the ones worth phrasing
 * properly for someone scanning the table.
 */
function describe(entry: AuditEntryDto): string {
  const context = entry.context ?? {};
  const parts: string[] = [];

  const listOf = (key: string): string[] => {
    const value = context[key];
    return Array.isArray(value) ? value : [];
  };

  const added = listOf('added');
  const removed = listOf('removed');
  const updated = listOf('updated');
  const fields = listOf('fields');

  if (added.length) parts.push(`added ${added.join(', ')}`);
  if (removed.length) parts.push(`removed ${removed.join(', ')}`);
  if (updated.length) parts.push(`changed ${updated.join(', ')}`);
  if (fields.length) parts.push(`edited ${fields.join(', ')}`);
  if (context.renamed_from) parts.push(`renamed from ${String(context.renamed_from)}`);
  if (context.from && context.to) parts.push(`${String(context.from)} → ${String(context.to)}`);
  if (context.project) parts.push(`in ${String(context.project)}`);
  if (context.tag) parts.push(String(context.tag));
  if (context.reason) parts.push(String(context.reason));
  if (context.sessions_ended !== undefined) parts.push(`${String(context.sessions_ended)} sessions ended`);
  if (context.secrets_destroyed !== undefined)
    parts.push(`${String(context.secrets_destroyed)} secrets destroyed`);

  return parts.length > 0 ? parts.join(' · ') : entry.detail || '—';
}
