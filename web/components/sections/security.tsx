"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { Lock, Shield } from "lucide-react";
import { SECURITY_POINTS, TECH_STACK } from "@/content/site-content";
import { Section } from "@/components/ui/section";
import { AuditStatusCard } from "@/components/ui/audit-status-card";
import { usePrefersReducedMotion } from "@/hooks/use-platform";

export function SecuritySection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.15, once: true });
  const reduced = usePrefersReducedMotion();

  return (
    <Section
      id="security"
      label="Security"
      title="Zero-knowledge contract"
      description="From the repository security model. Cloak has not undergone an independent audit — review the threat model before production use."
      accent
      icon={<Shield className="h-4 w-4" />}
    >
      <div ref={ref} className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="panel overflow-hidden p-2 sm:p-3">
          <div className="border-b border-[var(--color-border)] px-4 py-3">
            <p className="font-mono text-sm text-[var(--color-fg-muted)]">security.model</p>
          </div>
          <ul className="divide-y divide-[var(--color-border)]">
            {SECURITY_POINTS.map((point, index) => (
              <motion.li
                key={point}
                initial={reduced ? false : { opacity: 0, x: -12 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: index * 0.08, duration: 0.4 }}
                className="flex gap-4 px-4 py-4 text-base text-[var(--color-fg-muted)]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand-500/25 bg-brand-500/10 font-mono text-xs font-semibold text-brand-700 dark:text-brand-300">
                  {index + 1}
                </span>
                <Lock className="mt-1 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" strokeWidth={1.75} />
                <span className="leading-relaxed">{point}</span>
              </motion.li>
            ))}
          </ul>
        </div>

        <AuditStatusCard />
      </div>
    </Section>
  );
}

const STACK_GROUPS = [
  { label: "Desktop", rows: [TECH_STACK[0], TECH_STACK[1]] },
  { label: "Client", rows: [TECH_STACK[2], TECH_STACK[3]] },
  { label: "Cloud", rows: [TECH_STACK[4], TECH_STACK[5]] },
  { label: "Tooling", rows: [TECH_STACK[6]] },
] as const;

export function TechStackSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.15, once: true });
  const reduced = usePrefersReducedMotion();

  return (
    <Section
      label="Stack"
      title="Technologies"
      description="From the README tech stack table."
      alt
    >
      <div ref={ref} className="grid gap-4 sm:grid-cols-2">
        {STACK_GROUPS.map((group, gi) => (
            <motion.div
              key={group.label}
              initial={reduced ? false : { opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: gi * 0.1, duration: 0.45 }}
              className="panel overflow-hidden"
            >
              <div className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2.5">
                <span className="text-sm font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
                  {group.label}
                </span>
              </div>
              <div className="divide-y divide-[var(--color-border)]">
                {group.rows.map((row) => (
                  <div key={row.layer} className="px-4 py-3.5">
                    <p className="text-sm font-medium text-[var(--color-fg)]">{row.layer}</p>
                    <p className="mt-1 font-mono text-sm text-[var(--color-fg-muted)]">{row.tech}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
      </div>
    </Section>
  );
}
