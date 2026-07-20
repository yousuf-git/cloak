"use client";

import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, RefreshCw, Server } from "lucide-react";
import { usePrefersReducedMotion } from "@/hooks/use-platform";
import { cn } from "@/lib/utils";

function Shell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4",
        className,
      )}
      aria-hidden
    >
      {children}
    </div>
  );
}

/** Workflow 03 — opaque blob → API */
export function StoreCipherVisual({ className }: { className?: string }) {
  const reduced = usePrefersReducedMotion();

  return (
    <Shell className={className}>
      <div className="flex items-center gap-3">
        <motion.div
          className="min-w-0 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-3 font-mono text-[0.7rem]"
          animate={reduced ? undefined : { x: [0, 6, 0], opacity: [0.75, 1, 0.75] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <p className="text-[0.65rem] text-[var(--color-fg-subtle)]">outbound</p>
          <p className="mt-1 text-[var(--color-fg)]">blob · opaque</p>
          <p className="mt-0.5 text-[var(--color-fg-subtle)]">auth hash only</p>
        </motion.div>
        <motion.span
          animate={reduced ? undefined : { x: [0, 3, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          className="text-[var(--color-fg-subtle)]"
        >
          →
        </motion.span>
        <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]">
          <Server className="h-5 w-5 text-[var(--color-fg-muted)]" />
          <span className="font-mono text-[0.6rem] text-[var(--color-fg-subtle)]">API</span>
        </div>
      </div>
      <p className="mt-3 font-mono text-[0.65rem] text-[var(--color-fg-subtle)]">
        server cannot decrypt
      </p>
    </Shell>
  );
}

/** Workflow 04 — single field reveal on demand */
export function RevealFieldVisual({ className }: { className?: string }) {
  const reduced = usePrefersReducedMotion();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setOpen((o) => !o), 2400);
    return () => clearInterval(id);
  }, [reduced]);

  return (
    <Shell className={className}>
      <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-3 font-mono text-[0.7rem]">
        <div className="min-w-0">
          <p className="text-[0.65rem] text-[var(--color-fg-subtle)]">STRIPE_SECRET</p>
          <AnimatePresence mode="wait">
            <motion.p
              key={open ? "shown" : "hidden"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-1 truncate text-[var(--color-fg)]"
            >
              {open ? "sk_live_51HqR2…" : "••••••••••••••••"}
            </motion.p>
          </AnimatePresence>
        </div>
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-fg-muted)]">
          {open ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </span>
      </div>
      <p className="mt-3 font-mono text-[0.65rem] text-[var(--color-fg-subtle)]">
        decrypt on demand · one field
      </p>
    </Shell>
  );
}

/** Features · Exposure — multiple fields stay masked */
export function MaskedListVisual({ className }: { className?: string }) {
  const rows = [
    { key: "DATABASE_URL", mask: "••••••••••••" },
    { key: "API_TOKEN", mask: "••••••••" },
    { key: "JWT_SECRET", mask: "••••••••••••••" },
  ];

  return (
    <Shell className={className}>
      <p className="mb-3 font-mono text-[0.65rem] tracking-wide text-[var(--color-fg-subtle)] uppercase">
        vault · masked
      </p>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <motion.div
            key={row.key}
            initial={{ opacity: 0, y: 6 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.4 }}
            className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 font-mono text-[0.7rem]"
          >
            <span className="truncate text-[var(--color-fg)]">{row.key}</span>
            <span className="shrink-0 tracking-widest text-[var(--color-fg-subtle)]">{row.mask}</span>
          </motion.div>
        ))}
      </div>
      <p className="mt-3 font-mono text-[0.65rem] text-[var(--color-fg-subtle)]">
        no bulk decrypt on browse
      </p>
    </Shell>
  );
}

/** Features · Recovery — recovery key wrap */
export function RecoveryKeyVisual({ className }: { className?: string }) {
  const reduced = usePrefersReducedMotion();
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setPhase((p) => (p + 1) % 2), 2200);
    return () => clearInterval(id);
  }, [reduced]);

  return (
    <Shell className={className}>
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)]">
          <KeyRound className="h-5 w-5 text-[var(--color-fg-muted)]" />
        </div>
        <div className="min-w-0 flex-1 font-mono text-[0.7rem]">
          <p className="text-[0.65rem] text-[var(--color-fg-subtle)]">recovery key</p>
          <motion.p
            key={phase}
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 1 }}
            className="mt-1 truncate tracking-wide text-[var(--color-fg)]"
          >
            {phase === 0 ? "CLOAK-••••-••••-••••" : "re-wrap DEK · no plaintext"}
          </motion.p>
        </div>
        <RefreshCw
          className={cn(
            "mt-1 h-4 w-4 shrink-0 text-[var(--color-fg-subtle)]",
            !reduced && "animate-spin [animation-duration:3s]",
          )}
        />
      </div>
      <p className="mt-3 font-mono text-[0.65rem] text-[var(--color-fg-subtle)]">
        zero-knowledge recovery
      </p>
    </Shell>
  );
}
