import { useState } from 'react';
import { FolderLock, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { TextField } from '@/components/ui/TextField';
import { useProjects } from '@/hooks/vault';
import type { ProjectDto } from '@/lib/api';

/**
 * Pick the project an item belongs to, or create one without leaving the form.
 *
 * Env files always belong to a project, so they pass `required`. Everything
 * else can stand alone, and gets a "No project" choice — the empty string.
 */
export function ProjectField({
  value,
  onChange,
  required = false,
}: {
  value: string;
  onChange: (projectId: string) => void;
  required?: boolean;
}) {
  const { items: projects, create } = useProjects();
  // The new project is kept here until the refetched list includes it, so the
  // select never shows a value it has no option for.
  const [created, setCreated] = useState<ProjectDto | null>(null);
  const [creating, setCreating] = useState(required && projects.length === 0);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const known =
    created && !projects.some((p) => p._id === created._id) ? [...projects, created] : projects;
  const options = [
    ...(required ? [] : [{ value: '', label: 'No project' }]),
    ...known.map((p) => ({ value: p._id, label: p.name })),
  ];

  const createNow = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const project = await create({ name: trimmed });
      setCreated(project);
      onChange(project._id);
      setName('');
      setCreating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the project.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {options.length > 0 && (
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Select
              label={required ? 'Project' : 'Project (optional)'}
              value={value}
              onChange={onChange}
              options={options}
            />
          </div>
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            title={creating ? 'Cancel new project' : 'New project'}
            aria-label={creating ? 'Cancel new project' : 'New project'}
            className="no-drag flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-brand-500)' }}
          >
            {creating ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </button>
        </div>
      )}

      {creating && (
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <TextField
              label={options.length === 0 ? 'Create a project (env files belong to one)' : 'New project name'}
              placeholder="e.g. Acme API"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void createNow();
                }
              }}
            />
          </div>
          <Button size="sm" onClick={createNow} disabled={busy || !name.trim()}>
            {busy ? 'Creating…' : 'Create'}
          </Button>
        </div>
      )}

      {error && (
        <p className="text-xs" style={{ color: 'var(--color-danger)' }}>
          {error}
        </p>
      )}
    </div>
  );
}

/** The project an item belongs to, shown under its name. Nothing for a standalone item. */
export function ProjectTag({ projectId, projects }: { projectId?: string | null; projects: ProjectDto[] }) {
  const project = projectId ? projects.find((p) => p._id === projectId) : undefined;
  if (!project) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
      <FolderLock className="h-3 w-3" />
      {project.name}
    </span>
  );
}

/** Name of a project, for search. Empty for a standalone item. */
export function projectNameOf(projectId: string | null | undefined, projects: ProjectDto[]): string {
  return projectId ? (projects.find((p) => p._id === projectId)?.name ?? '') : '';
}
