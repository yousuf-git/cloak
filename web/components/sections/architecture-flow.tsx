"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import {
  ArrowDown,
  Cloud,
  Cpu,
  Database,
  FileText,
  KeyRound,
  Lock,
  Monitor,
  Server,
  Shield,
} from "lucide-react";
import { ARCHITECTURE, DOTENVX_FLOW } from "@/content/site-content";
import { usePrefersReducedMotion } from "@/hooks/use-platform";
import { cn } from "@/lib/utils";

const DESKTOP_STEPS = [
  { label: ARCHITECTURE.desktop[0].label, detail: ARCHITECTURE.desktop[0].detail, icon: Monitor },
  { label: ARCHITECTURE.desktop[1].label, detail: ARCHITECTURE.desktop[1].detail, icon: Cpu },
  { label: ARCHITECTURE.desktop[2].label, detail: ARCHITECTURE.desktop[2].detail, icon: Shield },
] as const;

const CLOUD_STEPS = [
  { label: ARCHITECTURE.cloud[0].label, detail: ARCHITECTURE.cloud[0].detail, icon: Server },
  { label: ARCHITECTURE.cloud[1].label, detail: ARCHITECTURE.cloud[1].detail, icon: Database },
] as const;

const DOTENVX_ICONS = [FileText, KeyRound] as const;

export function ArchitectureFlow() {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.15, once: true });

  return (
    <div ref={ref} className="grid gap-8 lg:grid-cols-2">
      <SystemFlow inView={inView} reduced={reduced} />
      <DotenvxFlow inView={inView} reduced={reduced} />
    </div>
  );
}

function SystemFlow({ inView, reduced }: { inView: boolean; reduced: boolean }) {
  return (
    <div className="panel relative overflow-hidden p-6 sm:p-8">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04] dark:opacity-[0.07]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 20 H40 M20 0 V40' stroke='%232d6a4f' stroke-width='0.5'/%3E%3C/svg%3E")`,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative">
        <div className="mb-6 flex items-center gap-2">
          <Monitor className="h-5 w-5 text-brand-600 dark:text-brand-400" />
          <h3 className="text-lg font-semibold">Desktop (Tauri)</h3>
        </div>

        <div className="space-y-0">
          {DESKTOP_STEPS.map((item, index) => (
            <div key={item.label}>
              <FlowStep
                step={index + 1}
                label={item.label}
                detail={item.detail}
                icon={item.icon}
                delay={index * 0.12}
                inView={inView}
                reduced={reduced}
                variant="desktop"
              />
              {index < DESKTOP_STEPS.length - 1 && (
                <FlowConnector
                  label="invoke"
                  delay={index * 0.12 + 0.06}
                  inView={inView}
                  reduced={reduced}
                />
              )}
            </div>
          ))}
        </div>

        <TransportBridge inView={inView} reduced={reduced} />

        <div className="mb-6 mt-8 flex items-center gap-2">
          <Cloud className="h-5 w-5 text-brand-600 dark:text-brand-400" />
          <h3 className="text-lg font-semibold">Cloud API</h3>
        </div>

        <div className="space-y-0">
          {CLOUD_STEPS.map((item, index) => (
            <div key={item.label}>
              <FlowStep
                step={index + 4}
                label={item.label}
                detail={item.detail}
                icon={item.icon}
                delay={0.4 + index * 0.12}
                inView={inView}
                reduced={reduced}
                variant="cloud"
              />
              {index < CLOUD_STEPS.length - 1 && (
                <FlowConnector
                  label="store"
                  delay={0.46 + index * 0.12}
                  inView={inView}
                  reduced={reduced}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DotenvxFlow({ inView, reduced }: { inView: boolean; reduced: boolean }) {
  return (
    <div className="panel relative overflow-hidden p-6 sm:p-8">
      <Lock
        className="pointer-events-none absolute -bottom-6 -right-4 h-32 w-32 text-brand-500/[0.06]"
        strokeWidth={1}
      />

      <div className="relative">
        <div className="mb-2 flex items-center gap-2">
          <Lock className="h-5 w-5 text-brand-600 dark:text-brand-400" />
          <h3 className="text-lg font-semibold">dotenvx encryption</h3>
        </div>
        <p className="mb-8 text-base text-[var(--color-fg-muted)]">
          Values encrypted individually. Private key sealed with master key. Both stored server-side
          as opaque data.
        </p>

        <div className="space-y-10">
          {DOTENVX_FLOW.map((row, trackIndex) => {
            const Icon = DOTENVX_ICONS[trackIndex];
            return (
              <div key={row.input}>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)]">
                  Track {trackIndex + 1}
                </p>
                <FlowStep
                  step={trackIndex * 3 + 1}
                  label={row.input}
                  detail="client-side input"
                  icon={Icon}
                  delay={0.15 + trackIndex * 0.2}
                  inView={inView}
                  reduced={reduced}
                  variant="input"
                  mono
                />
                <FlowConnector
                  label={row.step}
                  delay={0.22 + trackIndex * 0.2}
                  inView={inView}
                  reduced={reduced}
                  highlight
                />
                <FlowStep
                  step={trackIndex * 3 + 2}
                  label={row.output}
                  detail="opaque server blob"
                  icon={Lock}
                  delay={0.3 + trackIndex * 0.2}
                  inView={inView}
                  reduced={reduced}
                  variant="output"
                  mono
                />
              </div>
            );
          })}
        </div>

        <motion.div
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.65, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 border border-dashed border-brand-500/35 bg-brand-500/8 px-4 py-4 text-center"
        >
          <Database className="mx-auto mb-2 h-5 w-5 text-brand-600 dark:text-brand-400" />
          <p className="font-mono text-sm font-medium text-brand-700 dark:text-brand-300">
            Both stored together server-side
          </p>
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
            Neither readable without your master key
          </p>
        </motion.div>
      </div>
    </div>
  );
}

interface FlowStepProps {
  step: number;
  label: string;
  detail: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  delay: number;
  inView: boolean;
  reduced: boolean;
  variant: "desktop" | "cloud" | "input" | "output";
  mono?: boolean;
}

function FlowStep({
  step,
  label,
  detail,
  icon: Icon,
  delay,
  inView,
  reduced,
  variant,
  mono,
}: FlowStepProps) {
  const isOutput = variant === "output";

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, x: -16 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ delay, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative flex items-center gap-4 border px-4 py-3.5",
        isOutput
          ? "border-brand-500/30 bg-brand-500/10"
          : "border-[var(--color-border)] bg-[var(--color-bg)]",
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
          isOutput
            ? "bg-brand-600 text-white"
            : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg-muted)]",
        )}
      >
        {step}
      </span>

      <div className="icon-box shrink-0 !h-10 !w-10">
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </div>

      <div className="min-w-0 flex-1">
        <p className={cn("font-medium", mono && "font-mono text-sm")}>{label}</p>
        <p className="mt-0.5 text-sm text-[var(--color-fg-muted)]">{detail}</p>
      </div>

      {isOutput && (
        <motion.span
          initial={reduced ? false : { scale: 0 }}
          animate={inView ? { scale: 1 } : {}}
          transition={{ delay: delay + 0.15, type: "spring", stiffness: 260, damping: 18 }}
          className="hidden shrink-0 border border-brand-500/30 bg-brand-500/15 px-2 py-0.5 font-mono text-xs text-brand-700 sm:inline dark:text-brand-300"
        >
          sealed
        </motion.span>
      )}
    </motion.div>
  );
}

function FlowConnector({
  label,
  delay,
  inView,
  reduced,
  highlight,
}: {
  label: string;
  delay: number;
  inView: boolean;
  reduced: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-2 pl-6">
      <div className="relative flex flex-col items-center">
        <motion.div
          initial={reduced ? false : { height: 0 }}
          animate={inView ? { height: 20 } : {}}
          transition={{ delay, duration: 0.35, ease: "easeOut" }}
          className={cn(
            "w-px origin-top",
            highlight ? "bg-brand-500/50" : "bg-[var(--color-border-strong)]",
          )}
        />
        <ArrowDown
          className={cn(
            "h-4 w-4",
            highlight ? "text-brand-600 dark:text-brand-400" : "text-[var(--color-fg-subtle)]",
          )}
        />
      </div>
      <motion.span
        initial={reduced ? false : { opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ delay: delay + 0.1, duration: 0.3 }}
        className={cn(
          "font-mono text-sm",
          highlight ? "font-medium text-brand-600 dark:text-brand-400" : "text-[var(--color-fg-subtle)]",
        )}
      >
        {label}
      </motion.span>
      {!reduced && inView && (
        <motion.span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            highlight ? "bg-brand-500" : "bg-[var(--color-fg-subtle)]",
          )}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.6, repeat: Infinity, delay }}
        />
      )}
    </div>
  );
}

function TransportBridge({ inView, reduced }: { inView: boolean; reduced: boolean }) {
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, scaleX: 0.9 }}
      animate={inView ? { opacity: 1, scaleX: 1 } : {}}
      transition={{ delay: 0.38, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="my-6 origin-center"
    >
      <div className="relative border border-dashed border-brand-500/35 bg-brand-500/8 px-4 py-4">
        {!reduced && inView && (
          <motion.div
            className="absolute inset-x-8 top-1/2 h-px bg-gradient-to-r from-transparent via-brand-500/60 to-transparent"
            animate={{ opacity: [0.2, 0.8, 0.2], scaleX: [0.6, 1, 0.6] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        <p className="relative text-center font-mono text-sm font-medium text-brand-700 dark:text-brand-300">
          {ARCHITECTURE.transport}
        </p>
        <p className="relative mt-1 text-center text-xs text-[var(--color-fg-muted)]">
          Server never receives plaintext · never decrypts payloads
        </p>
      </div>
    </motion.div>
  );
}
