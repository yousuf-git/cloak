import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';

/** Animated boot/splash screen shown while the app initializes. */
export function Splash() {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6"
      style={{ backgroundColor: 'var(--color-bg)' }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.4, ease: 'easeInOut' } }}
    >
      <motion.div
        className="relative flex h-24 w-24 items-center justify-center rounded-3xl"
        style={{ backgroundColor: 'var(--color-brand-600)' }}
        initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18 }}
      >
        <motion.span
          className="absolute inset-0 rounded-3xl"
          style={{ boxShadow: '0 0 0 0 var(--color-brand-500)' }}
          animate={{ boxShadow: ['0 0 0 0 rgba(99,102,241,0.5)', '0 0 0 22px rgba(99,102,241,0)'] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
        />
        <ShieldCheck className="h-11 w-11 text-white" strokeWidth={1.75} />
      </motion.div>

      <motion.div
        className="flex flex-col items-center gap-1"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
      >
        <span className="text-2xl font-semibold tracking-tight">Cloak</span>
        <span className="text-sm" style={{ color: 'var(--color-fg-muted)' }}>
          Securing your vault…
        </span>
      </motion.div>
    </motion.div>
  );
}
