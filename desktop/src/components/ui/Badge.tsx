import type { ReactNode } from 'react';

type Tone = 'brand' | 'green' | 'amber' | 'red' | 'neutral';

const tones: Record<Tone, { bg: string; fg: string }> = {
  brand: { bg: 'color-mix(in srgb, var(--color-brand-500) 16%, transparent)', fg: 'var(--color-brand-400)' },
  green: { bg: 'color-mix(in srgb, #22c55e 16%, transparent)', fg: '#22c55e' },
  amber: { bg: 'color-mix(in srgb, #f59e0b 18%, transparent)', fg: '#f59e0b' },
  red: { bg: 'color-mix(in srgb, #ef4444 16%, transparent)', fg: '#ef4444' },
  neutral: { bg: 'var(--color-surface-2)', fg: 'var(--color-fg-muted)' },
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  const t = tones[tone];
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: t.bg, color: t.fg }}
    >
      {children}
    </span>
  );
}
