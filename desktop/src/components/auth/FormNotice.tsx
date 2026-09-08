import { motion } from 'framer-motion';
import { Info } from 'lucide-react';

/** Informational counterpart to FormError: explains a state, does not report a failure. */
export function FormNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
        color: 'var(--color-accent)',
      }}
      role="status"
    >
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </motion.div>
  );
}
