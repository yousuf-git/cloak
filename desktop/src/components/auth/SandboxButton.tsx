import { PlayCircle } from 'lucide-react';
import { useAppMode } from '@/stores/app-mode';

export function SandboxButton() {
  const enterSandbox = useAppMode((s) => s.enterSandbox);
  return (
    <div className="mt-6 flex flex-col items-center gap-2 border-t pt-5" style={{ borderColor: 'var(--color-border)' }}>
      <button
        type="button"
        onClick={enterSandbox}
        className="no-drag inline-flex items-center gap-2 text-xs font-medium transition-opacity hover:opacity-70"
        style={{ color: 'var(--color-fg-muted)' }}
      >
        <PlayCircle className="h-4 w-4" />
        Explore a sandbox with sample data
      </button>
      <span className="text-[11px]" style={{ color: 'var(--color-fg-muted)' }}>
        No account needed. Nothing you do here is saved.
      </span>
    </div>
  );
}
