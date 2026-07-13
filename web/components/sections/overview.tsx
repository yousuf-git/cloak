"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import {
  ArrowRight,
  CloudOff,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { VALUE_PROPS } from "@/content/site-content";
import { Section } from "@/components/ui/section";
import { usePrefersReducedMotion } from "@/hooks/use-platform";
import { cn } from "@/lib/utils";

const CARDS = [
  {
    ...VALUE_PROPS[0],
    step: "01",
    tag: "The gap",
    icon: KeyRound,
    watermark: KeyRound,
    tone: "muted" as const,
  },
  {
    ...VALUE_PROPS[1],
    step: "02",
    tag: "The risk",
    icon: CloudOff,
    watermark: CloudOff,
    tone: "warning" as const,
  },
  {
    ...VALUE_PROPS[2],
    step: "03",
    tag: "The answer",
    icon: ShieldCheck,
    watermark: ShieldCheck,
    tone: "brand" as const,
  },
] as const;

export function OverviewSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.2, once: true });
  const reduced = usePrefersReducedMotion();

  return (
    <Section
      label="Overview"
      title="A vault built for developer secrets"
      description="Cloak unifies credential storage with .env file management behind a native desktop interface. Zero-knowledge by contract — not by policy."
      icon={<ShieldAlert className="h-4 w-4" />}
    >
      <div ref={ref}>
        {/* Flow legend */}
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4 }}
          className="mb-8 hidden items-center justify-center gap-3 md:flex"
        >
          <FlowPill label="Problem" />
          <ArrowRight className="h-4 w-4 text-[var(--color-fg-subtle)]" />
          <FlowPill label="Problem" />
          <ArrowRight className="h-4 w-4 text-brand-600 dark:text-brand-400" />
          <FlowPill label="Solution" highlight />
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3">
          {CARDS.map((card, index) => (
            <OverviewCard
              key={card.title}
              card={card}
              index={index}
              inView={inView}
              reduced={reduced}
              isLast={index === CARDS.length - 1}
            />
          ))}
        </div>
      </div>
    </Section>
  );
}

function FlowPill({ label, highlight }: { label: string; highlight?: boolean }) {
  return (
    <span
      className={cn(
        "border px-3 py-1 text-sm font-medium",
        highlight
          ? "border-brand-500/40 bg-brand-500/10 text-brand-700 dark:text-brand-300"
          : "border-[var(--color-border)] text-[var(--color-fg-muted)]",
      )}
    >
      {label}
    </span>
  );
}

function OverviewCard({
  card,
  index,
  inView,
  reduced,
  isLast,
}: {
  card: (typeof CARDS)[number];
  index: number;
  inView: boolean;
  reduced: boolean;
  isLast: boolean;
}) {
  const Watermark = card.watermark;

  return (
    <motion.article
      initial={reduced ? false : { opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: index * 0.12, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "panel relative overflow-hidden p-6 sm:p-7",
        isLast && "border-brand-500/30 bg-brand-500/[0.06] md:-mt-1 md:shadow-lg md:shadow-brand-500/10",
      )}
    >
      {/* Background watermark */}
      <Watermark
        className={cn(
          "pointer-events-none absolute -bottom-4 -right-4 h-28 w-28",
          isLast ? "text-brand-500/12" : "text-[var(--color-fg)]/[0.04]",
        )}
        strokeWidth={0.75}
      />

      {/* Subtle grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='2' cy='2' r='1' fill='%232d6a4f'/%3E%3C/svg%3E")`,
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "font-mono text-sm font-semibold",
                isLast ? "text-brand-600 dark:text-brand-400" : "text-[var(--color-fg-subtle)]",
              )}
            >
              {card.step}
            </span>
            <div className={cn("icon-box", isLast && "!border-brand-500/30 !bg-brand-500/15")}>
              <card.icon className="h-5 w-5" strokeWidth={1.75} />
            </div>
          </div>
          <span
            className={cn(
              "border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
              card.tone === "brand" &&
                "border-brand-500/30 bg-brand-500/10 text-brand-700 dark:text-brand-300",
              card.tone === "warning" &&
                "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
              card.tone === "muted" && "border-[var(--color-border)] text-[var(--color-fg-muted)]",
            )}
          >
            {card.tag}
          </span>
        </div>

        <h3 className="text-lg font-semibold leading-snug">{card.title}</h3>
        <p className="mt-3 text-base leading-relaxed text-[var(--color-fg-muted)]">{card.body}</p>

        {isLast && (
          <motion.div
            initial={reduced ? false : { opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 0.45, duration: 0.4 }}
            className="mt-5 flex flex-wrap gap-2 border-t border-brand-500/20 pt-4"
          >
            {[".env files", "API keys", "Zero-knowledge sync"].map((chip) => (
              <span
                key={chip}
                className="border border-brand-500/25 bg-[var(--color-bg)] px-2.5 py-1 font-mono text-xs text-brand-700 dark:text-brand-300"
              >
                {chip}
              </span>
            ))}
          </motion.div>
        )}
      </div>

      {/* Desktop connector to next card */}
      {!isLast && (
        <div className="pointer-events-none absolute top-1/2 -right-3 z-10 hidden h-px w-6 bg-[var(--color-border-strong)] md:block" />
      )}
    </motion.article>
  );
}
