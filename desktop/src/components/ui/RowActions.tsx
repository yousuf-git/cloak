import { useState } from 'react';
import { Check, Download, Loader2, Pencil, Trash2 } from 'lucide-react';

/** Edit + delete icon actions shown on each list row (per the env-view sketch).
 *  `onDownload` may be async and may resolve `false` to signal "not saved"
 *  (e.g. the user cancelled the Save dialog) — the button only flashes a tick
 *  on a real save. */
export function RowActions({
  onDownload,
  onEdit,
  onDelete,
}: {
  onDownload?: () => void | boolean | Promise<void | boolean>;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const [dl, setDl] = useState<'idle' | 'busy' | 'done'>('idle');

  const handleDownload = async () => {
    if (!onDownload || dl === 'busy') return;
    setDl('busy');
    try {
      const result = await onDownload();
      if (result === false) {
        setDl('idle');
        return;
      }
      setDl('done');
      setTimeout(() => setDl('idle'), 2000);
    } catch {
      setDl('idle');
    }
  };

  return (
    <div className="flex items-center gap-1">
      {onDownload && (
        <button
          onClick={handleDownload}
          disabled={dl === 'busy'}
          title="Download"
          aria-label="Download"
          className="no-drag flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-black/5 disabled:opacity-60 dark:hover:bg-white/5"
          style={{ color: dl === 'done' ? '#22c55e' : 'var(--color-fg-muted)' }}
        >
          {dl === 'busy' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : dl === 'done' ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
        </button>
      )}
      {onEdit && (
        <button
          onClick={onEdit}
          title="Edit"
          aria-label="Edit"
          className="no-drag flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          style={{ color: 'var(--color-fg-muted)' }}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
      {onDelete && (
        <button
          onClick={onDelete}
          title="Delete"
          aria-label="Delete"
          className="no-drag flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          style={{ color: '#ef4444' }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
