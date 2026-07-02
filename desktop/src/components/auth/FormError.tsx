import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
      style={{
        backgroundColor: 'color-mix(in srgb, #dc2626 12%, transparent)',
        color: '#dc2626',
      }}
      role="alert"
    >
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </motion.div>
  );
}
