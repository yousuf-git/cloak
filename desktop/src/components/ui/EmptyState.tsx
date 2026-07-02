import type { ComponentType, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { SearchX } from 'lucide-react';

interface EmptyStateProps {
  icon: ComponentType<{ className?: string; strokeWidth?: number; style?: React.CSSProperties }>;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ backgroundColor: 'var(--color-surface-2)' }}
      >
        <Icon className="h-6 w-6" style={{ color: 'var(--color-brand-500)' }} strokeWidth={1.75} />
      </div>
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <p className="max-w-sm text-sm" style={{ color: 'var(--color-fg-muted)' }}>
        {description}
      </p>
      {action && <div className="mt-1">{action}</div>}
    </motion.div>
  );
}

/** Shown when a search query filters out every item. */
export function NoResults({ query }: { query: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col items-center justify-center gap-2 py-16 text-center"
    >
      <SearchX className="h-6 w-6" style={{ color: 'var(--color-fg-muted)' }} strokeWidth={1.75} />
      <p className="text-sm" style={{ color: 'var(--color-fg-muted)' }}>
        No matches for “{query.trim()}”.
      </p>
    </motion.div>
  );
}
