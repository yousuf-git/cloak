import { Fragment, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { AuditEntryDto } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

/**
 * Audit entries as a table, with each row opening the entry in full.
 *
 * Shared by the organization's audit log and a member's activity, so the two
 * cannot drift into describing the same entry differently.
 */
export function AuditTable({
  entries,
  showActor = true,
}: {
  entries: AuditEntryDto[];
  /** Off where every row is already the same person, such as a member's own page. */
  showActor?: boolean;
}) {
  const [opened, setOpened] = useState<AuditEntryDto | null>(null);

  return (
    <>
      <table className="w-full text-left text-sm">
        <thead
          className="sticky top-0 text-[11px] uppercase tracking-wide"
          style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-fg-muted)' }}
        >
          <tr>
            <th className="py-2 pr-4 font-medium">When</th>
            <th className="py-2 pr-4 font-medium">Action</th>
            {showActor && <th className="py-2 pr-4 font-medium">Who</th>}
            <th className="py-2 pr-4 font-medium">What</th>
            <th className="py-2 pr-4 font-medium">Details</th>
            <th className="py-2 font-medium">IP</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.id}
              role="button"
              tabIndex={0}
              onClick={() => setOpened(entry)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setOpened(entry);
                }
              }}
              className="cursor-pointer border-t align-top transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <td className="whitespace-nowrap py-2 pr-4 tabular-nums" style={{ color: 'var(--color-fg-muted)' }}>
                {formatDateTime(entry.created_at)}
              </td>
              <td className="py-2 pr-4">
                <div className="flex items-center gap-2">
                  <code className="text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
                    {entry.action}
                  </code>
                  {entry.outcome === 'failure' && <Badge tone="red">failed</Badge>}
                </div>
              </td>
              {showActor && <td className="py-2 pr-4">{entry.actor_email ?? '—'}</td>}
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
                <span className="inline-flex items-center gap-1">
                  {summarize(entry)}
                  {countsOnly(entry) && <ChevronRight className="h-3 w-3 shrink-0" />}
                </span>
              </td>
              <td className="py-2" style={{ color: 'var(--color-fg-muted)' }}>
                {entry.ip ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {opened && <EntryDetail entry={opened} onClose={() => setOpened(null)} />}
    </>
  );
}

/** Context keys holding the names of what changed, and how to say each one. */
const NAMED_CHANGES = {
  added: 'added',
  removed: 'removed',
  updated: 'changed',
  fields: 'edited',
} as const;

type ChangeKey = keyof typeof NAMED_CHANGES;

/** Past this many names, the row counts them and the detail view lists them. */
const INLINE_NAMES = 3;

type Context = Record<string, unknown>;

function namesIn(context: Context, key: ChangeKey): string[] {
  const value = context[key];
  return Array.isArray(value) ? value.map(String) : [];
}

/** Names the server dropped: it keeps a bounded number per entry. */
function droppedFrom(context: Context, key: ChangeKey): number {
  const value = context[`${key}_truncated`];
  return typeof value === 'number' ? value : 0;
}

function changeGroups(context: Context): { key: ChangeKey; names: string[]; dropped: number }[] {
  return (Object.keys(NAMED_CHANGES) as ChangeKey[])
    .map((key) => ({ key, names: namesIn(context, key), dropped: droppedFrom(context, key) }))
    .filter((group) => group.names.length > 0);
}

/**
 * Whether the row shows counts instead of names — which is also what makes
 * opening the entry worth the click.
 */
function countsOnly(entry: AuditEntryDto): boolean {
  const groups = changeGroups(entry.context ?? {});
  return groups.reduce((total, g) => total + g.names.length + g.dropped, 0) > INLINE_NAMES;
}

/**
 * The context of an entry, in words. The server already renders a flat
 * `detail` string for the CSV; the cases here are the ones worth phrasing
 * properly for someone scanning the table.
 *
 * A save that touched fifteen variables is one entry, not fifteen — so the row
 * has to stay one line. Past a handful of names it counts them instead, and the
 * names themselves move into the detail view.
 */
function summarize(entry: AuditEntryDto): string {
  const context = entry.context ?? {};
  const parts: string[] = [];

  const groups = changeGroups(context);
  const brief = countsOnly(entry);
  for (const { key, names, dropped } of groups) {
    parts.push(
      brief
        ? `${names.length + dropped} ${NAMED_CHANGES[key]}`
        : `${NAMED_CHANGES[key]} ${names.join(', ')}`,
    );
  }

  if (context.renamed_from) parts.push(`renamed from ${String(context.renamed_from)}`);
  if (context.moved_from) parts.push(`moved from ${String(context.moved_from)}`);
  if (context.from && context.to) parts.push(`${String(context.from)} → ${String(context.to)}`);
  if (context.project) parts.push(`in ${String(context.project)}`);
  if (context.tag) parts.push(String(context.tag));
  if (context.reason) parts.push(String(context.reason));
  if (context.sessions_ended !== undefined) parts.push(`${String(context.sessions_ended)} sessions ended`);
  if (context.secrets_destroyed !== undefined)
    parts.push(`${String(context.secrets_destroyed)} secrets destroyed`);

  return parts.length > 0 ? parts.join(' · ') : entry.detail || '—';
}

/** Context keys the detail view already renders as their own section. */
function isChangeKey(key: string): boolean {
  return Object.keys(NAMED_CHANGES).some((k) => key === k || key === `${k}_truncated`);
}

function humanize(key: string): string {
  return key.replace(/_/g, ' ');
}

/**
 * One entry in full: what it touched, and every name behind the counts the row
 * showed. Variable names only — a value has never been written to the trail, so
 * there is nothing here to hide.
 */
function EntryDetail({ entry, onClose }: { entry: AuditEntryDto; onClose: () => void }) {
  const context = entry.context ?? {};
  const groups = changeGroups(context);
  const rest = Object.entries(context).filter(([key]) => !isChangeKey(key));

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={entry.target_label ?? entry.resource ?? entry.action}
      description={`${entry.action} · ${entry.actor_email ?? 'unknown actor'} · ${formatDateTime(entry.created_at)}`}
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <div className="flex flex-col gap-5 pb-1">
        {entry.outcome === 'failure' && (
          <div>
            <Badge tone="red">failed</Badge>
          </div>
        )}

        {groups.map(({ key, names, dropped }) => (
          <section key={key}>
            <p className="text-xs font-medium">
              {names.length + dropped} {NAMED_CHANGES[key]}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {names.map((name) => (
                <code
                  key={name}
                  className="rounded-md border px-1.5 py-0.5 text-xs"
                  style={{ borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)' }}
                >
                  {name}
                </code>
              ))}
            </div>
            {dropped > 0 && (
              <p className="mt-1.5 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                {dropped} more were {NAMED_CHANGES[key]} but not named — an entry records a limited
                number of them.
              </p>
            )}
          </section>
        ))}

        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-xs">
          {rest.map(([key, value]) => (
            <Fragment key={key}>
              <dt style={{ color: 'var(--color-fg-muted)' }}>{humanize(key)}</dt>
              <dd>{Array.isArray(value) ? value.join(', ') : String(value)}</dd>
            </Fragment>
          ))}
          <dt style={{ color: 'var(--color-fg-muted)' }}>IP</dt>
          <dd>{entry.ip ?? '—'}</dd>
          {entry.user_agent && (
            <>
              <dt style={{ color: 'var(--color-fg-muted)' }}>device</dt>
              <dd>{entry.user_agent}</dd>
            </>
          )}
        </dl>
      </div>
    </Modal>
  );
}
