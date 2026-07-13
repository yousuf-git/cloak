"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { Check, Minus, Scale, Terminal, X } from "lucide-react";
import { INSTALL_STEPS, SCRIPTS, PREREQUISITES, COMPARISON_ROWS } from "@/content/site-content";
import { Section } from "@/components/ui/section";
import { CodePanel } from "@/components/ui/code-panel";
import { usePrefersReducedMotion } from "@/hooks/use-platform";
import { cn } from "@/lib/utils";

export function InstallSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.1, once: true });
  const reduced = usePrefersReducedMotion();

  return (
    <Section
      id="install"
      label="Setup"
      title="Getting started"
      description="Prerequisites and commands from the repository README."
      alt
      icon={<Terminal className="h-4 w-4" />}
    >
      <div className="mb-10 flex flex-wrap gap-2">
        {PREREQUISITES.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-2 border border-brand-500/20 bg-brand-500/8 px-3 py-1.5 text-base text-[var(--color-fg-muted)]"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            {item}
          </span>
        ))}
      </div>

      <div ref={ref} className="relative space-y-0">
        {INSTALL_STEPS.map((step, index) => (
          <motion.div
            key={step.title}
            initial={reduced ? false : { opacity: 0, x: -16 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: index * 0.1, duration: 0.45 }}
            className="relative grid gap-4 pb-8 lg:grid-cols-[80px_1fr]"
          >
            {/* Timeline */}
            <div className="flex flex-col items-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-brand-500/40 bg-brand-500/10 font-mono text-sm font-bold text-brand-700 dark:text-brand-300">
                {index + 1}
              </span>
              {index < INSTALL_STEPS.length - 1 && (
                <div className="mt-2 w-px flex-1 bg-gradient-to-b from-brand-500/40 to-transparent" />
              )}
            </div>

            <div>
              <h3 className="mb-3 text-lg font-semibold">{step.title}</h3>
              <CodePanel title={step.title} code={step.code} />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="panel mt-4 border-brand-500/20 bg-brand-500/5 px-5 py-4 text-base text-[var(--color-fg-muted)]">
        <span className="font-semibold text-[var(--color-fg)]">Quick preview: </span>
        <code className="font-mono text-brand-700 dark:text-brand-300">pnpm dev:desktop</code>
        {" "}— UI in browser. Sandbox mode, no API required.
      </div>
    </Section>
  );
}

export function ScriptsSection() {
  return (
    <Section label="Scripts" title="Workspace commands" description="Run from the repository root.">
      <div className="panel overflow-hidden">
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-2 font-mono text-sm text-[var(--color-fg-muted)]">pnpm — workspace</span>
        </div>
        <div className="divide-y divide-[var(--color-border)] font-mono text-base">
          {SCRIPTS.map((script) => (
            <div
              key={script.command}
              className="flex flex-col gap-1 px-5 py-4 transition-colors hover:bg-[var(--color-surface)] sm:flex-row sm:items-center sm:justify-between"
            >
              <code className="text-brand-600 dark:text-brand-400">{script.command}</code>
              <span className="font-sans text-sm text-[var(--color-fg-muted)]">{script.description}</span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

export function ComparisonSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.15, once: true });
  const reduced = usePrefersReducedMotion();

  return (
    <Section
      label="Comparison"
      title="Where Cloak fits"
      description="Qualitative comparison by product category — not a benchmark of specific vendors."
      alt
      icon={<Scale className="h-4 w-4" />}
    >
      <motion.div
        ref={ref}
        initial={reduced ? false : { opacity: 0, y: 16 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
        className="panel overflow-x-auto"
      >
        <table className="w-full min-w-[640px] text-left text-base">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="px-5 py-4 font-medium text-[var(--color-fg-muted)]">Capability</th>
              <th className="bg-brand-500/10 px-5 py-4 font-semibold text-brand-700 dark:text-brand-300">
                Cloak
              </th>
              <th className="px-5 py-4 font-medium text-[var(--color-fg-muted)]">Password managers</th>
              <th className="px-5 py-4 font-medium text-[var(--color-fg-muted)]">Cloud secret stores</th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map((row, i) => (
              <tr
                key={row.feature}
                className={cn(
                  "border-b border-[var(--color-border)] last:border-0",
                  i % 2 === 0 && "bg-[var(--color-bg)]/50",
                )}
              >
                <td className="px-5 py-4 font-medium">{row.feature}</td>
                <td className="bg-brand-500/5 px-5 py-4">
                  <CellValue value={row.cloak} highlight />
                </td>
                <td className="px-5 py-4">
                  <CellValue value={row.passwordManagers} />
                </td>
                <td className="px-5 py-4">
                  <CellValue value={row.cloudStores} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>
    </Section>
  );
}

function CellValue({ value, highlight }: { value: boolean | string; highlight?: boolean }) {
  if (value === true) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 font-medium", highlight && "text-brand-700 dark:text-brand-300")}>
        <Check className="h-4 w-4" strokeWidth={2.5} />
        Yes
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[var(--color-fg-subtle)]">
        <X className="h-4 w-4" strokeWidth={2} />
        No
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[var(--color-fg-muted)]">
      <Minus className="h-3.5 w-3.5" />
      {value}
    </span>
  );
}
