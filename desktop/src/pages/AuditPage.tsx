import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText, Download, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { TextField } from '@/components/ui/TextField';
import { orgApi } from '@/lib/api';
import { formatUtc } from '@/lib/utils';
import { useOrg } from '@/hooks/useOrg';
import { saveDownload, safeFilename } from '@/lib/native-fs';
import { toast } from '@/stores/toast';

export function AuditPage() {
  const { orgId, org } = useOrg();
  const [action, setAction] = useState('');
  const [cursors, setCursors] = useState<string[]>([]);
  const cursor = cursors.at(-1);

  const query = useQuery({
    queryKey: ['audit', orgId, action, cursor ?? 'first'],
    queryFn: () =>
      orgApi.listAudit(orgId!, {
        ...(action ? { action } : {}),
        ...(cursor ? { cursor } : {}),
      }),
    enabled: Boolean(orgId),
  });

  const entries = query.data?.entries ?? [];

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
          <Button size="sm" variant="outline" icon={<Download className="h-4 w-4" />} onClick={exportCsv}>
            Export CSV
          </Button>
        }
      />

      <div className="mb-4 max-w-xs">
        <TextField
          placeholder="Filter by action, e.g. cred:update"
          value={action}
          onChange={(e) => {
            setAction(e.target.value.trim());
            setCursors([]);
          }}
        />
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
                  <td className="py-2 pr-4">{entry.actor_email ?? '—'}</td>
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
