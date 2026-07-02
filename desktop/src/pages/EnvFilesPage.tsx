import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Upload, FileLock2, Eye, FolderLock, Loader2, ShieldAlert, Info, FileUp, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, NoResults } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { TextField } from '@/components/ui/TextField';
import { Select } from '@/components/ui/Select';
import { EnvViewer } from '@/components/env/EnvViewer';
import { useEnvFiles } from '@/hooks/useEnvFiles';
import { useProjects } from '@/hooks/vault';
import { useSearch, matchesQuery } from '@/stores/search';
import { parseEnv } from '@/lib/env-parse';
import type { EnvFileDto, EnvTag } from '@/lib/api';

const tagTone: Record<EnvTag, 'green' | 'amber' | 'red' | 'brand'> = {
  Local: 'green',
  Staging: 'amber',
  Production: 'red',
  Custom: 'brand',
};

export function EnvFilesPage() {
  const env = useEnvFiles();
  const { items: projects } = useProjects();
  const query = useSearch((s) => s.query);
  const [viewing, setViewing] = useState<EnvFileDto | null>(null);
  const [importing, setImporting] = useState(false);

  const projectName = (id: string) => projects.find((p) => p._id === id)?.name ?? 'Unassigned';
  const filtered = env.items.filter((f) => matchesQuery(query, f.label, projectName(f.project_id), f.tag));

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Env Files"
        description="dotenvx-encrypted .env files. Stored encrypted; decrypted only on demand with your key."
        actions={
          <Button size="sm" icon={<Upload className="h-4 w-4" />} onClick={() => setImporting(true)}>
            Import .env
          </Button>
        }
      />

      {env.isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--color-fg-muted)' }} />
        </div>
      ) : env.items.length === 0 ? (
        <EmptyState
          icon={FileLock2}
          title="No env files yet"
          description="Import a .env file — plain or already dotenvx-encrypted. It's stored encrypted and only decrypted when you ask."
          action={
            <Button icon={<Upload className="h-4 w-4" />} onClick={() => setImporting(true)}>
              Import your first .env
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <NoResults query={query} />
      ) : (
        <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          {filtered.map((file, i) => (
            <motion.div
              key={file._id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.3) }}
              className="flex items-center gap-3 border-b px-4 py-3 transition-colors last:border-b-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <FileLock2 className="h-4 w-4 shrink-0" style={{ color: 'var(--color-fg-muted)' }} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm">{file.label}</p>
                <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                  <FolderLock className="h-3 w-3" />
                  {projectName(file.project_id)} · {file.variable_count} vars
                  {!file.encrypted_dotenvx_key && ' · view-only'}
                </span>
              </div>
              <Badge tone={tagTone[file.tag]}>{file.tag}</Badge>
              <Button size="sm" variant="ghost" icon={<Eye className="h-3.5 w-3.5" />} onClick={() => setViewing(file)}>
                View
              </Button>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {viewing && (
          <EnvViewer
            file={viewing}
            onClose={() => setViewing(null)}
            getRaw={env.getRaw}
            decrypt={env.decrypt}
            saveEdit={env.saveEdit}
            remove={env.remove}
          />
        )}
      </AnimatePresence>

      {importing && (
        <ImportEnvModal
          projects={projects.map((p) => ({ id: p._id, name: p.name }))}
          onClose={() => setImporting(false)}
          onImportPlain={env.importPlain}
          onImportEncrypted={env.importEncrypted}
        />
      )}
    </div>
  );
}

function ImportEnvModal({
  projects,
  onClose,
  onImportPlain,
  onImportEncrypted,
}: {
  projects: { id: string; name: string }[];
  onClose: () => void;
  onImportPlain: (pid: string, label: string, tag: EnvTag, plaintext: string) => Promise<void>;
  onImportEncrypted: (
    pid: string,
    label: string,
    tag: EnvTag,
    content: string,
    key?: string,
  ) => Promise<void>;
}) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [label, setLabel] = useState('.env.local');
  const [tag, setTag] = useState<EnvTag>('Local');
  const [mode, setMode] = useState<'plain' | 'encrypted'>('plain');
  const [content, setContent] = useState('');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live structural validation of the pasted/loaded content.
  const parsed = content.trim() ? parseEnv(content) : null;
  const validationErrors = parsed?.errors ?? [];
  const hasContent = Boolean(content.trim());
  const canSubmit =
    Boolean(projectId) && Boolean(label.trim()) && hasContent && validationErrors.length === 0;

  const onPickFile = () => fileInputRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const text = await file.text();
      setContent(text);
      setFileName(file.name);
      if (file.name && file.name !== '.env') setLabel(file.name);
      // Auto-detect an already-encrypted dotenvx file.
      if (parseEnv(text).encrypted) setMode('encrypted');
    } catch {
      setError('Could not read that file.');
    } finally {
      // Allow re-selecting the same file.
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'plain') {
        await onImportPlain(projectId, label.trim(), tag, content);
      } else {
        await onImportEncrypted(projectId, label.trim(), tag, content, key.trim() || undefined);
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Import .env file"
      description="Choose whether your file is plaintext or already dotenvx-encrypted."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !canSubmit}>{busy ? 'Encrypting…' : 'Import'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 pb-4">
        {projects.length === 0 ? (
          <p className="text-xs" style={{ color: '#dc2626' }}>
            Create a project first — env files belong to a project.
          </p>
        ) : (
          <Select label="Project" value={projectId} onChange={setProjectId} options={projects.map((p) => ({ value: p.id, label: p.name }))} />
        )}

        <div className="grid grid-cols-2 gap-3">
          <TextField label="Label" placeholder=".env.production" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Select
            label="Environment"
            value={tag}
            onChange={(v) => setTag(v as EnvTag)}
            options={['Local', 'Staging', 'Production', 'Custom'].map((t) => ({ value: t, label: t }))}
          />
        </div>

        <SegmentedMode mode={mode} onChange={setMode} />

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium" style={{ color: 'var(--color-fg-muted)' }}>
              {mode === 'plain' ? 'Paste your .env contents' : 'Paste your encrypted .env contents'}
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".env,.txt,text/plain"
              onChange={onFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={onPickFile}
              className="no-drag inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{ color: 'var(--color-brand-500)' }}
            >
              <FileUp className="h-3.5 w-3.5" />
              Import from file
            </button>
          </div>
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setFileName(null);
            }}
            rows={7}
            spellCheck={false}
            placeholder={mode === 'plain' ? 'DATABASE_URL=postgres://…\nAPI_KEY=sk-…' : 'DOTENV_PUBLIC_KEY="…"\nAPI_KEY="encrypted:…"'}
            className="rounded-lg border px-3 py-2 font-mono text-xs outline-none focus:border-[var(--color-brand-500)]"
            style={{ backgroundColor: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
          />
          {fileName && (
            <p className="text-[11px]" style={{ color: 'var(--color-fg-muted)' }}>
              Loaded <span className="font-mono">{fileName}</span>
            </p>
          )}
          {parsed && validationErrors.length === 0 && (
            <p className="flex items-center gap-1.5 text-[11px]" style={{ color: '#16a34a' }}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              {parsed.count} variable{parsed.count === 1 ? '' : 's'} detected
              {parsed.encrypted ? ' · looks dotenvx-encrypted' : ''}
            </p>
          )}
          {validationErrors.length > 0 && (
            <ul className="flex flex-col gap-0.5">
              {validationErrors.slice(0, 4).map((msg) => (
                <li key={msg} className="flex items-start gap-1.5 text-[11px]" style={{ color: '#dc2626' }}>
                  <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" />
                  {msg}
                </li>
              ))}
            </ul>
          )}
        </div>

        {mode === 'plain' ? (
          <p className="flex items-start gap-1.5 text-[11px]" style={{ color: 'var(--color-fg-muted)' }}>
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            We'll generate a key, encrypt this file with dotenvx on your device, then wrap that key
            with your vault key. Only encrypted data leaves your machine.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <TextField
              label="dotenvx private key (optional)"
              placeholder="Paste the key so Cloak can decrypt this file later"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="font-mono"
            />
            <p className="flex items-start gap-1.5 text-[11px]" style={{ color: 'var(--color-fg-muted)' }}>
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: '#d97706' }} />
              Your key is wrapped with your vault key and never sent in plaintext. Leave it blank to
              store the file view-only — Cloak won't be able to decrypt it later.
            </p>
          </div>
        )}

        {error && (
          <p className="flex items-center gap-1.5 text-xs" style={{ color: '#dc2626' }}>
            <ShieldAlert className="h-3.5 w-3.5" /> {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

function SegmentedMode({ mode, onChange }: { mode: 'plain' | 'encrypted'; onChange: (m: 'plain' | 'encrypted') => void }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-lg p-1" style={{ backgroundColor: 'var(--color-surface-2)' }}>
      {(['plain', 'encrypted'] as const).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className="no-drag rounded-md py-1.5 text-xs font-medium capitalize transition-colors"
          style={{
            backgroundColor: mode === m ? 'var(--color-surface)' : 'transparent',
            color: mode === m ? 'var(--color-fg)' : 'var(--color-fg-muted)',
          }}
        >
          {m === 'plain' ? 'Plaintext' : 'Already encrypted'}
        </button>
      ))}
    </div>
  );
}

