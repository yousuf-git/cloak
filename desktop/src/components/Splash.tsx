import { motion } from 'framer-motion';

/** Animated boot/splash screen shown while the app initializes. */
export function Splash() {
  return (
    <motion.div
      className="alloy-grid fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      style={{ background: 'var(--gradient-canvas)' }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.015, transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] } }}
    >
      <div className="pointer-events-none absolute inset-x-[8%] top-11 flex items-center gap-4" aria-hidden>
        <span className="telemetry-label">CLOAK / BOOT SEQUENCE</span>
        <span className="metal-rule flex-1" />
        <span className="telemetry-label">LOCAL CORE</span>
      </div>

      <motion.section
        className="alloy-panel relative flex w-[min(34rem,calc(100%-3rem))] flex-col items-center rounded-[var(--radius-2xl)] px-10 py-12"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.span
          className="auth-icon relative z-10 flex h-20 w-20 items-center justify-center rounded-2xl"
          initial={{ scale: 0.84, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.12, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.span
            className="absolute inset-[-10px] rounded-[1.35rem] border"
            style={{ borderColor: 'var(--color-border-strong)' }}
            animate={{ rotate: 360 }}
            transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
          />
          <img src="/cloak-mono.png" alt="" className="h-12 w-12 dark:brightness-0 dark:invert" />
        </motion.span>

        <motion.div
          className="relative z-10 mt-7 flex flex-col items-center gap-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <span className="font-display text-2xl font-semibold tracking-[-0.04em]">Cloak</span>
          <span className="telemetry-label">Establishing encrypted perimeter</span>
        </motion.div>

        <div className="relative z-10 mt-8 h-px w-full overflow-hidden" style={{ backgroundColor: 'var(--color-border-soft)' }}>
          <motion.span
            className="absolute inset-y-0 left-0 w-1/3"
            style={{ background: 'var(--gradient-metal)' }}
            animate={{ x: ['-100%', '300%'] }}
            transition={{ duration: 1.25, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </motion.section>
    </motion.div>
  );
}
