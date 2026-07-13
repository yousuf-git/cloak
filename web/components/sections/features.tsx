"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { Layers } from "lucide-react";
import { FEATURES } from "@/content/site-content";
import { Section } from "@/components/ui/section";
import { usePrefersReducedMotion } from "@/hooks/use-platform";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  "Cryptography",
  "Cryptography",
  "Vault",
  "Vault",
  "Auth",
  "Auth",
  "Auth",
  "UX",
  "UX",
] as const;

export function FeaturesSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.1, once: true });
  const reduced = usePrefersReducedMotion();

  return (
    <Section
      id="features"
      label="Features"
      title="What you get"
      description="Nine capabilities from the README — cryptography, vault modules, dotenvx, recovery, and sandbox mode."
      alt
      icon={<Layers className="h-4 w-4" />}
    >
      <div ref={ref} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature, index) => {
          const isHighlight = index === 0;
          const Icon = feature.icon;

          return (
            <motion.article
              key={feature.title}
              initial={reduced ? false : { opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: index * 0.05, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "group panel relative overflow-hidden p-6 transition-shadow hover:shadow-lg hover:shadow-brand-500/5",
                isHighlight && "sm:col-span-2 lg:col-span-1 lg:row-span-1 border-brand-500/25 bg-brand-500/[0.04]",
              )}
            >
              <Icon
                className="pointer-events-none absolute -bottom-3 -right-3 h-24 w-24 text-[var(--color-fg)]/[0.03] transition-colors group-hover:text-brand-500/10"
                strokeWidth={0.75}
              />

              <div className="relative">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-semibold text-[var(--color-fg-subtle)]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className={cn("icon-box", isHighlight && "!border-brand-500/30 !bg-brand-500/15")}>
                      <Icon className="h-5 w-5" strokeWidth={1.75} />
                    </div>
                  </div>
                  <span className="border border-[var(--color-border)] px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-[var(--color-fg-muted)]">
                    {CATEGORIES[index]}
                  </span>
                </div>

                <h3 className="font-semibold leading-snug">{feature.title}</h3>
                <p className="mt-2 text-base leading-relaxed text-[var(--color-fg-muted)]">
                  {feature.description}
                </p>
              </div>
            </motion.article>
          );
        })}
      </div>
    </Section>
  );
}
