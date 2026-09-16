import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  KeyRound,
  Link2,
  Loader2,
  Copy,
  Check,
  Upload,
  Download,
  FileUp,
  ShieldAlert,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SecretField } from '@/components/ui/SecretField';
import { RowActions } from '@/components/ui/RowActions';
import { EmptyState, NoResults } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { TextField } from '@/components/ui/TextField';
import { useCreds, useProjects } from '@/hooks/vault';
import { ProjectField, ProjectTag, projectNameOf } from '@/components/ProjectField';
import { useVaultCrypto } from '@/hooks/useVaultCrypto';
import { useSearch, matchesQuery } from '@/stores/search';
import type { CredDto, ProjectDto } from '@/lib/api';
import {
  parseCsv,
  autoMap,
  toImportRows,
  normalizeRow,
  projectColumn,
  CRED_FIELDS,
  PROJECT_HEADER,
  type ColumnMapping,
  type CredField,
  type ImportRow,
  type SourcedRow,
} from '@/lib/csv-parse';
import {
  credsToCsv,
  encryptBackup,
  decryptBackup,
  asBackupEnvelope,
  sampleCredsCsv,
} from '@/lib/vault-export';
import {
  planImport,
  heldBack,
  imported,
  failed,
  logToText,
  type LogEntry,
  type LogStatus,
  type PlannedRow,
} from '@/lib/cred-import';
import { saveDownload } from '@/lib/native-fs';

export function CredentialsPage() {
  const { items, isLoading, create, update, remove } = useCreds();
  const { items: projects } = useProjects();
  const { encrypt, decrypt } = useVaultCrypto();
  const query = useSearch((s) => s.query);
  const [editing, setEditing] = useState<CredDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<CredDto | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const filtered = items.filter((c) =>
    matchesQuery(query, c.name, c.url, c.note, projectNameOf(c.project_id, projects)),
  );

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Credentials"
        description="Passwords encrypted with your Master Key and masked by default; usernames kept as searchable plaintext."
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              icon={<Upload className="h-4 w-4" />}
              onClick={() => setImporting(true)}
            >
              Import
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={<Download className="h-4 w-4" />}
              onClick={() => setExporting(true)}
              disabled={items.length === 0}
            >
              Export
            </Button>
            <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
              New Credential
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <Loading />
      ) : items.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="No credentials yet"
          description="Store your first username & password. It's encrypted on this device before it ever syncs."
          action={
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
              Add your first credential
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <NoResults query={query} />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((cred, i) => (
            <motion.div
              key={cred._id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.3) }}
              className="rounded-xl border p-4"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--color-surface-2)' }}>
                    <KeyRound className="h-4 w-4" style={{ color: 'var(--color-brand-500)' }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{cred.name}</p>
                    <div className="flex flex-wrap items-center gap-x-3">
                      {cred.url && (
                        <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                          <Link2 className="h-3 w-3" />
                          {cred.url}
                        </span>
                      )}
                      <ProjectTag projectId={cred.project_id} projects={projects} />
                    </div>
                  </div>
                </div>
                <RowActions onEdit={() => setEditing(cred)} onDelete={() => setDeleting(cred)} />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Username">
                  <PlainField value={cred.username} />
                </Field>
                <Field label="Password">
                  <SecretField cipher={cred.password} reveal={() => decrypt(cred.password)} maskLength={20} />
                </Field>
              </div>
              {cred.note && (
                <p className="mt-3 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                  {cred.note}
                </p>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <CredentialForm
          initial={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSubmit={async (values) => {
            const payload: Partial<CredDto> = {
              name: values.name,
              url: values.url || undefined,
              note: values.note || undefined,
              username: values.username, // plaintext — username is not a secret
              password: await encrypt(values.password),
              // Cleared on an edit means "standalone now", which the server takes as null.
              project_id: values.projectId || (editing ? null : undefined),
            };
            if (editing) await update(editing._id, payload);
            else await create(payload);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete credential?"
        message={`"${deleting?.name}" will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await remove(deleting._id);
          setDeleting(null);
        }}
      />

      {importing && (
        <ImportCredsModal
          existing={items}
          projects={projects}
          onClose={() => setImporting(false)}
          importRow={async (r: SourcedRow, projectId: string | null) => {
            await create({
              name: r.name,
              url: r.url || undefined,
              note: r.note || undefined,
              username: r.username,
              password: await encrypt(r.password),
              project_id: projectId ?? undefined,
            });
          }}
        />
      )}

      {exporting && <ExportCredsModal items={items} onClose={() => setExporting(false)} />}
    </div>
  );
}

interface FormValues {
  name: string;
  url: string;
  username: string;
  password: string;
  note: string;
  projectId: string;
}

function CredentialForm({
  initial,
  onClose,
  onSubmit,
}: {
  initial: CredDto | null;
  onClose: () => void;
  onSubmit: (v: FormValues) => Promise<void>;
}) {
  const { decrypt } = useVaultCrypto();
  const [values, setValues] = useState<FormValues>({
    name: initial?.name ?? '',
    url: initial?.url ?? '',
    username: '',
    password: '',
    note: initial?.note ?? '',
    projectId: initial?.project_id ?? '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  // Prefill on edit: username is plaintext; only the password needs decrypting.
  useEffect(() => {
    if (!initial) return;
    setValues((v) => ({ ...v, username: initial.username }));
    decrypt(initial.password)
      .then((p) => setValues((v) => ({ ...v, password: p })))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    if (!values.name.trim() || !values.username || !values.password) return;
    setBusy(true);
    try {
      await onSubmit(values);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? 'Edit credential' : 'New credential'}
      description="Secrets are encrypted on this device before saving."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : initial ? 'Save changes' : 'Create'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 pb-4">
        <TextField label="Name" placeholder="e.g. AWS Root Console" value={values.name} onChange={set('name')} />
        <TextField label="URL (optional)" placeholder="console.aws.amazon.com" value={values.url} onChange={set('url')} />
        <TextField label="Username" value={values.username} onChange={set('username')} />
        <TextField label="Password" revealToggle value={values.password} onChange={set('password')} />
        <ProjectField value={values.projectId} onChange={(projectId) => setValues((v) => ({ ...v, projectId }))} />
        <TextField label="Note (optional)" value={values.note} onChange={set('note')} />
      </div>
    </Modal>
  );
}

/** Plaintext value display (username is not a secret — no mask/decrypt). */
function PlainField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="flex items-center gap-2">
      <code
        data-selectable="true"
        className="min-w-0 flex-1 truncate rounded-md px-2.5 py-1.5 font-mono text-xs"
        style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-fg)' }}
      >
        {value}
      </code>
      <button
        onClick={copy}
        title="Copy"
        aria-label="Copy"
        className="no-drag flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/5"
        style={{ color: 'var(--color-fg-muted)' }}
      >
        {copied ? <Check className="h-3.5 w-3.5" style={{ color: '#22c55e' }} /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-fg-muted)' }}>
        {label}
      </p>
      {children}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--color-fg-muted)' }} />
    </div>
  );
}

// ------------------------------------------------------------------ Import ---

const LOG_ORDER: LogStatus[] = ['failed', 'project_unknown', 'project_invalid', 'duplicate', 'imported'];

const LOG_LABEL: Record<LogStatus, { text: string; tone: 'green' | 'amber' | 'red' | 'neutral' }> = {
  imported: { text: 'Imported', tone: 'green' },
  failed: { text: 'Failed', tone: 'red' },
  project_unknown: { text: 'Unknown project', tone: 'red' },
  project_invalid: { text: 'Invalid project id', tone: 'red' },
  duplicate: { text: 'Duplicate', tone: 'neutral' },
};

const CSV_FILTER = [{ name: 'CSV', extensions: ['csv'] }];

function ImportCredsModal({
  existing,
  projects,
  onClose,
  importRow,
}: {
  existing: CredDto[];
  projects: ProjectDto[];
  onClose: () => void;
  importRow: (row: SourcedRow, projectId: string | null) => Promise<void>;
}) {
  const [raw, setRaw] = useState('');
  const [decrypted, setDecrypted] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [mapping, setMapping] = useState<ColumnMapping>({
    name: null,
    url: null,
    username: null,
    password: null,
    note: null,
  });
  const [dedupe, setDedupe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [log, setLog] = useState<LogEntry[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const envelope = decrypted === null ? asBackupEnvelope(raw) : null;
  const source = decrypted ?? raw;
  const parsed = source.trim() && !envelope ? parseCsv(source) : null;
  const headerKey = parsed?.headers.join('\u0000') ?? '';

  // Re-run auto-mapping whenever a new set of headers appears.
  useEffect(() => {
    if (parsed) setMapping(autoMap(parsed.headers));
  }, [headerKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = parsed ? toImportRows(parsed, mapping).map(normalizeRow) : [];
  const ignoredEmpty = parsed ? parsed.rows.length - rows.length : 0;
  const hasProjectColumn = parsed ? projectColumn(parsed.headers) !== null : false;
  const plans = planImport(rows, existing, projects, dedupe);
  const ready = plans.filter((p) => p.plan.status === 'ready');
  const linked = ready.filter((p) => p.plan.status === 'ready' && p.plan.projectId).length;
  const duplicates = plans.filter((p) => p.plan.status === 'duplicate').length;
  const projectProblems = plans.filter(
    (p) => p.plan.status === 'project_unknown' || p.plan.status === 'project_invalid',
  ).length;

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const text = await file.text();
      setRaw(text);
      setDecrypted(null);
    } catch {
      setError('Could not read that file.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const downloadSample = () =>
    saveDownload('cloak-credentials-sample.csv', sampleCredsCsv(projects[0]), {
      mime: 'text/csv',
      filters: CSV_FILTER,
    });

  const decryptBackupNow = async () => {
    if (!envelope) return;
    setBusy(true);
    setError(null);
    try {
      setDecrypted(await decryptBackup(passphrase, envelope));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not decrypt backup.');
    } finally {
      setBusy(false);
    }
  };

  // Row by row, so one refused row is logged and the rest still go in.
  const runImport = async () => {
    if (!ready.length) return;
    setBusy(true);
    setError(null);
    const entries: LogEntry[] = plans.filter((p) => p.plan.status !== 'ready').map(heldBack);
    setProgress({ done: 0, total: ready.length });
    for (const [i, planned] of ready.entries()) {
      const projectId = planned.plan.status === 'ready' ? planned.plan.projectId : null;
      try {
        await importRow(planned.row, projectId);
        entries.push(imported(planned));
      } catch (err) {
        entries.push(failed(planned, err instanceof Error ? err.message : 'unknown error'));
      }
      setProgress({ done: i + 1, total: ready.length });
    }
    setLog(entries);
    setProgress(null);
    setBusy(false);
  };

  if (log) {
    return (
      <ImportLogView
        entries={log}
        ignoredEmpty={ignoredEmpty}
        copied={copied}
        onCopy={async () => {
          try {
            await navigator.clipboard.writeText(logToText(log, ignoredEmpty));
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          } catch {
            /* clipboard unavailable */
          }
        }}
        onClose={onClose}
      />
    );
  }

  const columnOptions = [
    { value: '', label: '— none —' },
    ...(parsed?.headers.map((h, i) => ({ value: String(i), label: h || `Column ${i + 1}` })) ?? []),
  ];

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      size="lg"
      title="Import credentials"
      description="A Google Password Manager CSV, a Cloak CSV export, or an encrypted Cloak backup. Passwords are encrypted on this device before saving."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          {envelope ? (
            <Button onClick={decryptBackupNow} disabled={busy || !passphrase}>
              {busy ? 'Decrypting…' : 'Decrypt backup'}
            </Button>
          ) : (
            <Button onClick={runImport} disabled={busy || ready.length === 0}>
              {progress
                ? `Importing ${progress.done} of ${progress.total}…`
                : `Import ${ready.length || ''}`.trim()}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-3 pb-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-medium" style={{ color: 'var(--color-fg-muted)' }}>
              Paste CSV or backup contents
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.cloak,.json,.txt,text/csv,text/plain,application/json"
              onChange={onFile}
              className="hidden"
            />
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="no-drag inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                style={{ color: 'var(--color-brand-500)' }}
              >
                <FileUp className="h-3.5 w-3.5" />
                Choose file
              </button>
              <button
                type="button"
                onClick={downloadSample}
                title="A CSV in the shape this import accepts"
                className="no-drag inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                style={{ color: 'var(--color-fg-muted)' }}
              >
                <Download className="h-3.5 w-3.5" />
                Sample CSV
              </button>
            </div>
          </div>
          <textarea
            value={decrypted ?? raw}
            onChange={(e) => {
              setRaw(e.target.value);
              setDecrypted(null);
            }}
            readOnly={decrypted !== null || busy}
            rows={6}
            spellCheck={false}
            placeholder={`name,url,username,password,note,${PROJECT_HEADER}\nGitHub,https://github.com,octocat,••••••,,`}
            className="rounded-lg border px-3 py-2 font-mono text-xs outline-none focus:border-[var(--color-brand-500)]"
            style={{ backgroundColor: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
          />
          <p className="text-[11px]" style={{ color: 'var(--color-fg-muted)' }}>
            Linking to projects is optional. A <code className="font-mono">{PROJECT_HEADER}</code> column is
            only read from files exported by Cloak; leave a cell empty for a standalone credential.
          </p>
        </div>

        {envelope && (
          <div className="flex flex-col gap-1.5">
            <p className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--color-fg-muted)' }}>
              <Lock className="h-3.5 w-3.5" />
              Encrypted Cloak backup detected — enter its passphrase to continue.
            </p>
            <TextField
              label="Backup passphrase"
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
            />
          </div>
        )}

        {parsed && (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CRED_FIELDS.map((field) => (
                <Select
                  key={field}
                  label={fieldLabel(field)}
                  value={mapping[field] === null ? '' : String(mapping[field])}
                  onChange={(v) =>
                    setMapping((m) => ({ ...m, [field]: v === '' ? null : Number(v) }))
                  }
                  options={columnOptions}
                />
              ))}
            </div>

            <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
              <input type="checkbox" checked={dedupe} onChange={(e) => setDedupe(e.target.checked)} />
              Skip duplicates (same name &amp; username)
            </label>

            {mapping.password === null && (
              <p className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-danger)' }}>
                <ShieldAlert className="h-3.5 w-3.5" />
                Map the Password column to import.
              </p>
            )}

            <ul className="flex flex-col gap-0.5 text-xs">
              <li className="flex items-center gap-1.5" style={{ color: ready.length ? '#16a34a' : 'var(--color-fg-muted)' }}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                {ready.length} ready to import
                {hasProjectColumn && ` — ${linked} into a project, ${ready.length - linked} standalone`}
              </li>
              {projectProblems > 0 && (
                <li className="flex items-center gap-1.5" style={{ color: 'var(--color-danger)' }}>
                  <ShieldAlert className="h-3.5 w-3.5" />
                  {projectProblems} won&apos;t be imported: their project id doesn&apos;t match a project here
                </li>
              )}
              {duplicates > 0 && (
                <li style={{ color: 'var(--color-fg-muted)' }}>
                  {duplicates} duplicate{duplicates === 1 ? '' : 's'} will be skipped
                </li>
              )}
              {ignoredEmpty > 0 && (
                <li style={{ color: 'var(--color-fg-muted)' }}>
                  {ignoredEmpty} empty row{ignoredEmpty === 1 ? '' : 's'} ignored
                </li>
              )}
            </ul>

            {plans.length > 0 && <ImportPreview plans={plans} showProject={hasProjectColumn} />}
          </>
        )}

        {error && (
          <p className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-danger)' }}>
            <ShieldAlert className="h-3.5 w-3.5" />
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

/** Every row and what the import will do with it, before anything is written. */
function ImportPreview({ plans, showProject }: { plans: PlannedRow[]; showProject: boolean }) {
  return (
    <div className="max-h-56 overflow-auto rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
      <table className="w-full text-left text-[11px]">
        <thead className="sticky top-0" style={{ backgroundColor: 'var(--color-surface)' }}>
          <tr style={{ color: 'var(--color-fg-muted)' }}>
            <th className="px-2 py-1 font-medium">Line</th>
            <th className="px-2 py-1 font-medium">Name</th>
            <th className="px-2 py-1 font-medium">Username</th>
            {showProject && <th className="px-2 py-1 font-medium">Project</th>}
            <th className="px-2 py-1 font-medium">Will</th>
          </tr>
        </thead>
        <tbody>
          {plans.map(({ row, plan }) => (
            <tr key={row.line} style={{ borderTop: '1px solid var(--color-border)' }}>
              <td className="px-2 py-1 tabular-nums" style={{ color: 'var(--color-fg-muted)' }}>{row.line}</td>
              <td className="max-w-40 truncate px-2 py-1">{row.name}</td>
              <td className="max-w-32 truncate px-2 py-1">{row.username || '—'}</td>
              {showProject && (
                <td className="max-w-40 truncate px-2 py-1">
                  {plan.status === 'ready' ? (
                    plan.projectName ?? <span style={{ color: 'var(--color-fg-muted)' }}>Standalone</span>
                  ) : plan.status === 'project_unknown' ? (
                    <span style={{ color: 'var(--color-danger)' }} title={plan.value}>No such project</span>
                  ) : plan.status === 'project_invalid' ? (
                    <span style={{ color: 'var(--color-danger)' }} title={plan.value}>Not a project id</span>
                  ) : (
                    <span style={{ color: 'var(--color-fg-muted)' }}>—</span>
                  )}
                </td>
              )}
              <td className="px-2 py-1">
                {plan.status === 'ready' ? (
                  <Badge tone="green">Import</Badge>
                ) : plan.status === 'duplicate' ? (
                  <Badge tone="neutral">Skip</Badge>
                ) : (
                  <Badge tone="red">Hold back</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * What the import actually did, row by row: problems first, since those are the
 * rows that need a decision, then what was skipped and what went in.
 */
function ImportLogView({
  entries,
  ignoredEmpty,
  copied,
  onCopy,
  onClose,
}: {
  entries: LogEntry[];
  ignoredEmpty: number;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
}) {
  const count = (status: LogStatus) => entries.filter((e) => e.status === status).length;
  const sorted = entries
    .slice()
    .sort((a, b) => LOG_ORDER.indexOf(a.status) - LOG_ORDER.indexOf(b.status) || a.line - b.line);
  const notImported = count('failed') + count('project_unknown') + count('project_invalid');

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Import finished"
      description={
        notImported > 0
          ? `${count('imported')} imported. ${notImported} need attention — fix those rows in the file and import it again; rows already imported will be skipped as duplicates.`
          : `${count('imported')} imported.`
      }
      footer={
        <>
          <Button variant="ghost" icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} onClick={onCopy}>
            {copied ? 'Copied' : 'Copy log'}
          </Button>
          <Button onClick={onClose}>Done</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 pb-4">
        <div className="flex flex-wrap gap-1.5">
          {LOG_ORDER.filter((s) => count(s) > 0).map((s) => (
            <Badge key={s} tone={LOG_LABEL[s].tone}>
              {count(s)} {LOG_LABEL[s].text.toLowerCase()}
            </Badge>
          ))}
          {ignoredEmpty > 0 && <Badge tone="neutral">{ignoredEmpty} empty ignored</Badge>}
        </div>

        <ul className="flex flex-col divide-y rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
          {sorted.map((entry) => (
            <li key={`${entry.line}-${entry.status}`} className="flex gap-3 px-3 py-2">
              <span className="w-12 shrink-0 text-[11px] tabular-nums" style={{ color: 'var(--color-fg-muted)' }}>
                line {entry.line}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs font-medium">{entry.name}</span>
                  <Badge tone={LOG_LABEL[entry.status].tone}>{LOG_LABEL[entry.status].text}</Badge>
                </div>
                <p className="mt-0.5 text-[11px]" style={{ color: 'var(--color-fg-muted)' }}>
                  {entry.detail}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}

function fieldLabel(field: CredField): string {
  return field.charAt(0).toUpperCase() + field.slice(1);
}

// ------------------------------------------------------------------ Export ---

function ExportCredsModal({ items, onClose }: { items: CredDto[]; onClose: () => void }) {
  const { decrypt } = useVaultCrypto();
  const [mode, setMode] = useState<'encrypted' | 'plain'>('encrypted');
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [acknowledge, setAcknowledge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildRows = async (): Promise<ImportRow[]> =>
    Promise.all(
      items.map(async (c) => ({
        name: c.name,
        url: c.url ?? '',
        username: c.username, // plaintext
        password: await decrypt(c.password),
        note: c.note ?? '',
        project_id: c.project_id ?? '',
      })),
    );

  const canExport =
    mode === 'plain'
      ? acknowledge
      : passphrase.length >= 8 && passphrase === confirm;

  const runExport = async () => {
    setBusy(true);
    setError(null);
    try {
      const rows = await buildRows();
      const csv = credsToCsv(rows);
      if (mode === 'plain') {
        await saveDownload('cloak-credentials.csv', csv, {
          mime: 'text/csv',
          filters: [{ name: 'CSV', extensions: ['csv'] }],
        });
      } else {
        const envelope = await encryptBackup(passphrase, csv);
        await saveDownload('cloak-backup.cloak', envelope, {
          mime: 'application/json',
          filters: [{ name: 'Cloak backup', extensions: ['cloak'] }],
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Export credentials"
      description={`Export all ${items.length} credential${items.length === 1 ? '' : 's'}.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={runExport} disabled={busy || !canExport}>
            {busy ? 'Exporting…' : 'Export'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 pb-4">
        <div className="grid grid-cols-2 gap-2">
          <ModeCard
            active={mode === 'encrypted'}
            onClick={() => setMode('encrypted')}
            icon={<Lock className="h-4 w-4" />}
            title="Encrypted backup"
            hint="Passphrase-protected .cloak file"
          />
          <ModeCard
            active={mode === 'plain'}
            onClick={() => setMode('plain')}
            icon={<ShieldAlert className="h-4 w-4" />}
            title="Plaintext CSV"
            hint="Google-compatible, unprotected"
          />
        </div>

        {mode === 'encrypted' ? (
          <>
            <TextField
              label="Passphrase (min 8 chars)"
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
            />
            <TextField
              label="Confirm passphrase"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {confirm.length > 0 && passphrase !== confirm && (
              <p className="text-xs" style={{ color: 'var(--color-danger)' }}>
                Passphrases don't match.
              </p>
            )}
            <p className="text-[11px]" style={{ color: 'var(--color-fg-muted)' }}>
              You'll need this passphrase to import the backup later. It cannot be recovered.
            </p>
          </>
        ) : (
          <label
            className="flex items-start gap-2 rounded-lg border p-3 text-xs"
            style={{ borderColor: 'var(--color-danger)', color: 'var(--color-fg)' }}
          >
            <input
              type="checkbox"
              checked={acknowledge}
              onChange={(e) => setAcknowledge(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I understand this file contains <strong>every password in plaintext</strong>, is not
              encrypted, and anyone who opens it can read my secrets.
            </span>
          </label>
        )}

        {error && (
          <p className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-danger)' }}>
            <ShieldAlert className="h-3.5 w-3.5" />
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

function ModeCard({
  active,
  onClick,
  icon,
  title,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors"
      style={{
        borderColor: active ? 'var(--color-brand-500)' : 'var(--color-border)',
        backgroundColor: active ? 'var(--color-surface-2)' : 'transparent',
      }}
    >
      <span className="flex items-center gap-1.5 text-xs font-medium">
        {icon}
        {title}
      </span>
      <span className="text-[11px]" style={{ color: 'var(--color-fg-muted)' }}>
        {hint}
      </span>
    </button>
  );
}
