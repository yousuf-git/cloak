import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Plus,
  FolderLock,
  FileLock2,
  Link2,
  Loader2,
  Trash2,
  Eye,
  FolderInput,
  KeyRound,
  ShieldCheck,
  KeySquare,
  TerminalSquare,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { TextField } from '@/components/ui/TextField';
import { SecretField } from '@/components/ui/SecretField';
import { EnvViewer } from '@/components/env/EnvViewer';
import { MoveToProjectDialog } from '@/components/MoveToProjectDialog';
import { useAccessKeys, useApiKeys, useCreds, useProjects, useSshKeys } from '@/hooks/vault';
import { useEnvFiles } from '@/hooks/useEnvFiles';
import { useVaultCrypto } from '@/hooks/useVaultCrypto';
import { useSearch, matchesQuery } from '@/stores/search';
import type {
  AccessKeyDto,
  ApiKeyDto,
  CredDto,
  EnvFileDto,
  EnvTag,
  ProjectDto,
  SshKeyDto,
} from '@/lib/api';
import { cn } from '@/lib/utils';

const tagTone: Record<EnvTag, 'green' | 'amber' | 'red' | 'brand'> = {
  Local: 'green',
  Staging: 'amber',
  Production: 'red',
  Custom: 'brand',
};

interface Contents {
  env: EnvFileDto[];
  creds: CredDto[];
  apiKeys: ApiKeyDto[];
  accessKeys: AccessKeyDto[];
  sshKeys: SshKeyDto[];
}

type Kind = keyof Contents;

/** Every kind of item a project can hold, in the order a project shows them. */
const KINDS: { kind: Kind; title: string; one: string; many: string; icon: typeof FileLock2 }[] = [
  { kind: 'env', title: 'Env files', one: 'env file', many: 'env files', icon: FileLock2 },
  { kind: 'creds', title: 'Credentials', one: 'credential', many: 'credentials', icon: KeyRound },
  { kind: 'apiKeys', title: 'API keys', one: 'API key', many: 'API keys', icon: ShieldCheck },
  { kind: 'accessKeys', title: 'Access keys', one: 'access key', many: 'access keys', icon: KeySquare },
  { kind: 'sshKeys', title: 'SSH keys', one: 'SSH key', many: 'SSH keys', icon: TerminalSquare },
];

/** "2 env files · 1 credential" — only the kinds the project actually has. */
function summarize(contents: Contents): string {
  return KINDS.filter(({ kind }) => contents[kind].length > 0)
    .map(({ kind, one, many }) => {
      const n = contents[kind].length;
      return `${n} ${n === 1 ? one : many}`;
    })
    .join(' · ');
}

export function ProjectsPage() {
  const { items, isLoading, create, remove } = useProjects();
  const env = useEnvFiles();
  const creds = useCreds();
  const apiKeys = useApiKeys();
  const accessKeys = useAccessKeys();
  const sshKeys = useSshKeys();
  const query = useSearch((s) => s.query);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<ProjectDto | null>(null);

  const filtered = items.filter((p) => matchesQuery(query, p.name, p.url, p.note));

  useEffect(() => {
    if (!selectedId && items.length > 0) setSelectedId(items[0]!._id);
    if (selectedId && !items.some((p) => p._id === selectedId)) {
      setSelectedId(items[0]?._id ?? null);
    }
  }, [items, selectedId]);

  const selected = items.find((p) => p._id === selectedId) ?? null;

  // Filtered here rather than fetched per project: every list is already loaded
  // for its own page, and the counts in the project rail need all of them anyway.
  const contentsOf = (projectId: string): Contents => ({
    env: env.items.filter((x) => x.project_id === projectId),
    creds: creds.items.filter((x) => x.project_id === projectId),
    apiKeys: apiKeys.items.filter((x) => x.project_id === projectId),
    accessKeys: accessKeys.items.filter((x) => x.project_id === projectId),
    sshKeys: sshKeys.items.filter((x) => x.project_id === projectId),
  });

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Projects"
        description="Group env files, credentials and keys by the codebase or service they belong to."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} size="sm" onClick={() => setCreating(true)}>
            New Project
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--color-fg-muted)' }} />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={FolderLock}
          title="No projects yet"
          description="Create a project to keep a codebase's env files, credentials and keys together."
          action={
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
              Create your first project
            </Button>
          }
        />
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
          <div className="flex min-h-0 flex-col gap-2 overflow-y-auto pr-1">
            {filtered.length === 0 && (
              <p className="px-1 py-6 text-center text-sm" style={{ color: 'var(--color-fg-muted)' }}>
                No projects match “{query.trim()}”.
              </p>
            )}
            {filtered.map((project) => {
              const isActive = project._id === selected?._id;
              const summary = summarize(contentsOf(project._id));
              return (
                <button
                  key={project._id}
                  onClick={() => setSelectedId(project._id)}
                  className={cn('no-drag group relative w-full rounded-xl border p-4 text-left transition-colors', isActive ? '' : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.03]')}
                  style={{
                    borderColor: isActive ? 'var(--color-brand-500)' : 'var(--color-border)',
                    backgroundColor: isActive ? 'color-mix(in srgb, var(--color-brand-500) 8%, transparent)' : 'var(--color-surface)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--color-surface-2)' }}>
                      <FolderLock className="h-4 w-4" style={{ color: 'var(--color-brand-500)' }} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-display truncate text-sm font-semibold">{project.name}</p>
                      <p className="truncate text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                        {summary || 'Empty'}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {selected && (
            <ProjectDetail
              project={selected}
              contents={contentsOf(selected._id)}
              env={env}
              relink={{
                creds: (id, projectId) => creds.update(id, { project_id: projectId }),
                apiKeys: (id, projectId) => apiKeys.update(id, { project_id: projectId }),
                accessKeys: (id, projectId) => accessKeys.update(id, { project_id: projectId }),
                sshKeys: (id, projectId) => sshKeys.update(id, { project_id: projectId }),
              }}
              onDelete={() => setDeleting(selected)}
            />
          )}
        </div>
      )}

      {creating && (
        <ProjectForm
          onClose={() => setCreating(false)}
          onSubmit={async (v) => {
            const project = await create(v);
            setSelectedId(project._id);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete project?"
        message={`"${deleting?.name}" will be removed. Everything in it stays in the vault — it just no longer belongs to a project.`}
        confirmLabel="Delete"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await remove(deleting._id);
          setDeleting(null);
        }}
      />
    </div>
  );
}

/**
 * One project, shaped by what it holds: a section per kind of item it has, and
 * nothing for the kinds it does not.
 */
function ProjectDetail({
  project,
  contents,
  env,
  relink,
  onDelete,
}: {
  project: ProjectDto;
  contents: Contents;
  env: ReturnType<typeof useEnvFiles>;
  /** Per kind that can stand alone: move an item, or detach it with null. */
  relink: Record<Exclude<Kind, 'env'>, (id: string, projectId: string | null) => Promise<void>>;
  onDelete: () => void;
}) {
  const { decrypt } = useVaultCrypto();
  const [viewing, setViewing] = useState<EnvFileDto | null>(null);
  const [moving, setMoving] = useState<{ kind: Kind; id: string; name: string } | null>(null);
  const moveButton = (kind: Kind, id: string, name: string) => (
    <Button
      size="sm"
      variant="ghost"
      icon={<FolderInput className="h-3.5 w-3.5" />}
      onClick={() => setMoving({ kind, id, name })}
    >
      Move
    </Button>
  );
  const present = KINDS.filter(({ kind }) => contents[kind].length > 0);

  return (
    <motion.div
      key={project._id}
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
      className="flex min-h-0 flex-col overflow-hidden rounded-xl border"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <div className="border-b p-5" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight">{project.name}</h2>
            {project.url && (
              <span className="mt-1 inline-flex items-center gap-1 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                <Link2 className="h-3 w-3" />
                {project.url}
              </span>
            )}
            {project.note && (
              <p className="mt-1 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                {project.note}
              </p>
            )}
          </div>
          <button
            onClick={onDelete}
            title="Delete project"
            aria-label="Delete project"
            className="no-drag flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{ color: 'var(--color-danger)' }}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {present.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {present.map(({ kind, one, many, icon: Icon }) => {
              const n = contents[kind].length;
              return (
                <span
                  key={kind}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs"
                  style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-fg-muted)' }}
                >
                  <Icon className="h-3 w-3" />
                  {n} {n === 1 ? one : many}
                </span>
              );
            })}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {present.length === 0 ? (
          <EmptyState
            icon={FolderLock}
            title="Nothing in this project yet"
            description="Choose this project when you add an env file, credential, API key, access key or SSH key, and it shows up here."
          />
        ) : (
          <div className="flex flex-col gap-5">
            {present.map(({ kind, title, icon }) => (
              <KindSection key={kind} title={title} icon={icon} count={contents[kind].length}>
                {kind === 'env' &&
                  contents.env.map((file) => (
                    <ItemRow
                      key={file._id}
                      icon={FileLock2}
                      title={file.label}
                      mono
                      subtitle={`${file.variable_count} variables${file.encrypted_dotenvx_key ? '' : ' · view-only'}`}
                      trailing={
                        <>
                          <Badge tone={tagTone[file.tag]}>{file.tag}</Badge>
                          {moveButton('env', file._id, file.label)}
                          <Button size="sm" variant="ghost" icon={<Eye className="h-3.5 w-3.5" />} onClick={() => setViewing(file)}>
                            View
                          </Button>
                        </>
                      }
                    />
                  ))}
                {kind === 'creds' &&
                  contents.creds.map((cred) => (
                    <ItemRow
                      key={cred._id}
                      icon={KeyRound}
                      title={cred.name}
                      subtitle={cred.username || cred.url}
                      secret={<SecretField cipher={cred.password} reveal={() => decrypt(cred.password)} maskLength={20} />}
                      trailing={moveButton('creds', cred._id, cred.name)}
                    />
                  ))}
                {kind === 'apiKeys' &&
                  contents.apiKeys.map((key) => (
                    <ItemRow
                      key={key._id}
                      icon={ShieldCheck}
                      title={key.label}
                      subtitle={key.url}
                      secret={<SecretField cipher={key.key} reveal={() => decrypt(key.key)} maskLength={24} />}
                      trailing={moveButton('apiKeys', key._id, key.label)}
                    />
                  ))}
                {kind === 'accessKeys' &&
                  contents.accessKeys.map((key) => (
                    <ItemRow
                      key={key._id}
                      icon={KeySquare}
                      title={key.title}
                      subtitle={key.access_key_id}
                      secret={
                        <SecretField
                          cipher={key.secret_access_key}
                          reveal={() => decrypt(key.secret_access_key)}
                          maskLength={24}
                        />
                      }
                      trailing={moveButton('accessKeys', key._id, key.title)}
                    />
                  ))}
                {kind === 'sshKeys' &&
                  contents.sshKeys.map((key) => (
                    <ItemRow
                      key={key._id}
                      icon={TerminalSquare}
                      title={key.title}
                      subtitle={[key.key_type, key.format, key.comment].filter(Boolean).join(' · ')}
                      trailing={moveButton('sshKeys', key._id, key.title)}
                    />
                  ))}
              </KindSection>
            ))}
          </div>
        )}
      </div>

      {moving && (
        <MoveToProjectDialog
          itemName={moving.name}
          currentProjectId={project._id}
          required={moving.kind === 'env'}
          onMove={(projectId) =>
            moving.kind === 'env' ? env.move(moving.id, projectId!) : relink[moving.kind](moving.id, projectId)
          }
          onClose={() => setMoving(null)}
        />
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
    </motion.div>
  );
}

function KindSection({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string;
  icon: typeof FileLock2;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-1 flex items-center gap-2 px-3 text-xs font-semibold" style={{ color: 'var(--color-fg-muted)' }}>
        <Icon className="h-3.5 w-3.5" />
        {title}
        <span className="font-normal">{count}</span>
      </h3>
      <ul className="flex flex-col gap-1">{children}</ul>
    </section>
  );
}

/**
 * One item inside a project. Secrets reveal in place; editing stays on the
 * item's own page, which has the full form.
 */
function ItemRow({
  icon: Icon,
  title,
  subtitle,
  mono = false,
  secret,
  trailing,
}: {
  icon: typeof FileLock2;
  title: string;
  subtitle?: string;
  mono?: boolean;
  secret?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <li className="flex flex-col gap-2 rounded-lg px-3 py-2.5 transition-colors hover:bg-black/[0.03] sm:flex-row sm:items-center sm:gap-3 dark:hover:bg-white/[0.03]">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Icon className="h-4 w-4 shrink-0" style={{ color: 'var(--color-fg-muted)' }} />
        <div className="min-w-0">
          <p className={cn('truncate text-sm', mono && 'font-mono')}>{title}</p>
          {subtitle && (
            <p className="truncate text-xs" style={{ color: 'var(--color-fg-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {secret && <div className="min-w-0 sm:w-72">{secret}</div>}
      {trailing && <div className="flex shrink-0 items-center gap-2">{trailing}</div>}
    </li>
  );
}

function ProjectForm({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (v: { name: string; url?: string; note?: string }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onSubmit({ name: name.trim(), url: url.trim() || undefined, note: note.trim() || undefined });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="New project"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? 'Creating…' : 'Create'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 pb-4">
        <TextField label="Name" placeholder="e.g. Aurora API" value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label="Repository / URL (optional)" placeholder="github.com/acme/aurora" value={url} onChange={(e) => setUrl(e.target.value)} />
        <TextField label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  );
}
