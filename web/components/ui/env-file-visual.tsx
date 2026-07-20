"use client";

import { motion } from "motion/react";
import { Lock } from "lucide-react";
import { usePrefersReducedMotion } from "@/hooks/use-platform";
import { cn } from "@/lib/utils";

const ROWS = [
  { key: "DATABASE_URL", cipher: "enc:v1:a8f3…c21d" },
  { key: "STRIPE_SECRET", cipher: "enc:v1:9b2e…f04a" },
  { key: "JWT_SECRET", cipher: "enc:v1:4c7d…8e91" },
  { key: "REDIS_URL", cipher: "enc:v1:1f6a…3b72" },
] as const;

/** Editorial .env mock — replaces loader-style Lottie for the dotenvx feature */
export function EnvFileVisual({ className }: { className?: string }) {
  const reduced = usePrefersReducedMotion();

  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-[320px] font-mono",
        className,
      )}
      aria-hidden
    >
      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[var(--color-border-strong)]" />
            <span className="text-xs tracking-wide text-[var(--color-fg-subtle)]">
              production.env
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[0.65rem] tracking-wide text-[var(--color-fg-subtle)] uppercase">
            <Lock className="h-3 w-3" />
            sealed
          </span>
        </div>

        <div className="space-y-0 divide-y divide-[var(--color-border)] p-1">
          {ROWS.map((row, i) => (
            <motion.div
              key={row.key}
              initial={reduced ? false : { opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{
                duration: 0.45,
                delay: i * 0.08,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="flex items-center justify-between gap-3 px-3 py-3"
            >
              <span className="truncate text-[0.7rem] text-[var(--color-fg)] sm:text-xs">
                {row.key}
              </span>
              <motion.span
                className="shrink-0 text-[0.65rem] text-[var(--color-fg-subtle)] sm:text-[0.7rem]"
                animate={
                  reduced
                    ? undefined
                    : {
                        opacity: [0.45, 1, 0.45],
                      }
                }
                transition={{
                  duration: 2.8,
                  delay: i * 0.35,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                {row.cipher}
              </motion.span>
            </motion.div>
          ))}
        </div>
      </div>

      <p className="mt-4 text-center text-[0.65rem] tracking-wide text-[var(--color-fg-subtle)]">
        dotenvx · master-key wrapped
      </p>
    </div>
  );
}
