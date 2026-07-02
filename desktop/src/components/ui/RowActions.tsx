import { Pencil, Trash2 } from 'lucide-react';

/** Edit + delete icon actions shown on each list row (per the env-view sketch). */
export function RowActions({ onEdit, onDelete }: { onEdit?: () => void; onDelete?: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onEdit}
        title="Edit"
        aria-label="Edit"
        className="no-drag flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/5"
        style={{ color: 'var(--color-fg-muted)' }}
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onDelete}
        title="Delete"
        aria-label="Delete"
        className="no-drag flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/5"
        style={{ color: '#ef4444' }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
