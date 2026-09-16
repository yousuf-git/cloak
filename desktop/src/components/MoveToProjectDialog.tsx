import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ProjectField } from '@/components/ProjectField';
import { useProjects } from '@/hooks/vault';

/**
 * Move one item into another project — or back into one after its project was
 * deleted — without opening its full edit form.
 *
 * `required` is for env files, which always belong to a project; everything
 * else can also be made standalone here.
 */
export function MoveToProjectDialog({
  itemName,
  currentProjectId,
  required = false,
  onMove,
  onClose,
}: {
  itemName: string;
  currentProjectId?: string | null;
  required?: boolean;
  /** Null makes the item standalone. */
  onMove: (projectId: string | null) => Promise<void>;
  onClose: () => void;
}) {
  const { items: projects } = useProjects();
  // A link to a project that no longer exists is no link: start from the
  // picker's empty state, so choosing any project counts as a change.
  const current = currentProjectId && projects.some((p) => p._id === currentProjectId) ? currentProjectId : '';
  const [projectId, setProjectId] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unchanged = projectId === current;
  const canMove = !busy && !unchanged && (!required || projectId !== '');

  const move = async () => {
    setBusy(true);
    setError(null);
    try {
      await onMove(projectId || null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not move it.');
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Move “${itemName}”`}
      description={
        required
          ? 'Env files always belong to a project. Pick the one this file belongs to.'
          : 'Pick a project, or No project to keep it standalone.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={move} disabled={!canMove}>
            {busy ? 'Moving…' : 'Move'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2 pb-4">
        <ProjectField value={projectId} onChange={setProjectId} required={required} />
        {error && (
          <p className="text-xs" style={{ color: 'var(--color-danger)' }}>
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
