import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, FolderLock, FileLock2, Link2, Loader2, Trash2, Eye, Upload } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { TextField } from '@/components/ui/TextField';
import { EnvViewer } from '@/components/env/EnvViewer';
import { useProjects } from '@/hooks/vault';
import { useEnvFiles } from '@/hooks/useEnvFiles';
import { useSearch, matchesQuery } from '@/stores/search';
import type { EnvFileDto, EnvTag, ProjectDto } from '@/lib/api';
import { cn } from '@/lib/utils';

const tagTone: Record<EnvTag, 'green' | 'amber' | 'red' | 'brand'> = {
  Local: 'green',
  Staging: 'amber',
  Production: 'red',
  Custom: 'brand',
};

export function ProjectsPage() {
  const { items, isLoading, create, remove } = useProjects();
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

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Projects"
        description="Group environment files by project. One tile per project."
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
          description="Create a project to organize your encrypted .env files by codebase or service."
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
                      {project.url && (
                        <p className="truncate text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                          {project.url}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {selected && (
            <ProjectDetail
              project={selected}
              onDelete={() => setDeleting(selected)}
            />
          )}
        </div>
      )}

      {creating && (
        <ProjectForm
          onClose={() => setCreating(false)}
          onSubmit={async (v) => {
            await create(v);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete project?"
        message={`"${deleting?.name}" will be removed. Env files linked to it remain but become unassigned.`}
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

function ProjectDetail({ project, onDelete }: { project: ProjectDto; onDelete: () => void }) {
  const env = useEnvFiles(project._id);
  const [viewing, setViewing] = useState<EnvFileDto | null>(null);

  return (
    <motion.div
      key={project._id}
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
      className="flex min-h-0 flex-col overflow-hidden rounded-xl border"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <div className="flex items-start justify-between gap-3 border-b p-5" style={{ borderColor: 'var(--color-border)' }}>
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
          className="no-drag flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          style={{ color: '#ef4444' }}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {env.isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--color-fg-muted)' }} />
          </div>
        ) : env.items.length === 0 ? (
          <EmptyState
            icon={FileLock2}
            title="No env files"
            description="Import an encrypted .env file for this project from the Env Files page."
            action={<Badge tone="brand"><Upload className="mr-1 inline h-3 w-3" />Use Import on Env Files</Badge>}
          />
        ) : (
          <ul className="flex flex-col gap-1">
            {env.items.map((file) => (
              <li key={file._id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.03]">
                <FileLock2 className="h-4 w-4 shrink-0" style={{ color: 'var(--color-fg-muted)' }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-sm">{file.label}</p>
                  <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                    {file.variable_count} variables{!file.encrypted_dotenvx_key && ' · view-only'}
                  </p>
                </div>
                <Badge tone={tagTone[file.tag]}>{file.tag}</Badge>
                <Button size="sm" variant="ghost" icon={<Eye className="h-3.5 w-3.5" />} onClick={() => setViewing(file)}>
                  View
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

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
