import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { useToast } from '@/stores/toast';

/** Bottom-right transient notifications. Each toast self-dismisses (store timer)
 *  and carries an explicit close button. */
export function Toaster() {
  const toasts = useToast((s) => s.toasts);
  const dismiss = useToast((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="pointer-events-auto flex items-start gap-2.5 rounded-lg border px-3 py-2.5 shadow-lg"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              boxShadow: '0 10px 30px -12px rgba(0,0,0,0.45)',
            }}
          >
            {t.variant === 'success' ? (
              <CheckCircle2 className="mt-px h-4 w-4 shrink-0" style={{ color: '#16a34a' }} />
            ) : (
              <AlertTriangle className="mt-px h-4 w-4 shrink-0" style={{ color: '#dc2626' }} />
            )}
            <p className="min-w-0 flex-1 break-all text-xs leading-relaxed" style={{ color: 'var(--color-fg)' }}>
              {t.message}
            </p>
            <button
              onClick={() => dismiss(t.id)}
              title="Dismiss"
              aria-label="Dismiss"
              className="no-drag -mr-1 -mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{ color: 'var(--color-fg-muted)' }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
