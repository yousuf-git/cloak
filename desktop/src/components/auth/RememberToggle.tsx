import { cn } from '@/lib/utils';

export function RememberToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="no-drag flex items-center gap-3 text-left"
    >
      <span
        className={cn('relative h-5 w-9 shrink-0 rounded-md transition-colors')}
        style={{
          backgroundColor: checked ? 'var(--color-accent)' : 'var(--color-canvas-inset)',
          border: '1px solid var(--color-border-strong)',
        }}
      >
        <span
          className="absolute top-0.5 h-3.5 w-3.5 rounded-[3px] transition-transform"
          style={{ backgroundColor: 'var(--color-silver)', transform: checked ? 'translateX(18px)' : 'translateX(3px)' }}
        />
      </span>
      <span className="flex flex-col">
        <span className="text-xs font-medium">Trust this device for 30 days</span>
        <span className="text-[11px]" style={{ color: 'var(--color-fg-muted)' }}>
          Stores your key in the OS keychain. Only enable on private machines.
        </span>
      </span>
    </button>
  );
}
