import { AlertTriangle, Shield, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuditStatusCardProps {
  className?: string;
}

export function AuditStatusCard({ className }: AuditStatusCardProps) {
  return (
    <aside
      className={cn(
        "panel relative overflow-hidden text-base",
        className,
      )}
    >
      {/* Background pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035] dark:opacity-[0.06]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='48' height='48' viewBox='0 0 48 48' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M24 4 L40 12 V24 C40 34 24 42 24 42 C24 42 8 34 8 24 V12 Z' fill='none' stroke='%232d6a4f' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundSize: "48px 48px",
        }}
      />

      {/* Large watermark shield — fills right / bottom */}
      <Shield
        className="pointer-events-none absolute -bottom-8 -right-6 h-44 w-44 text-brand-500/[0.07] dark:text-brand-500/10"
        strokeWidth={0.75}
      />

      {/* Soft radial accent */}
      <div className="pointer-events-none absolute top-0 right-0 h-32 w-32 bg-amber-500/8 blur-3xl" />

      <div className="relative flex h-full min-h-[280px] flex-col p-6">
        {/* Status pill */}
        <div className="mb-5 inline-flex w-fit items-center gap-2 border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4" strokeWidth={2} />
          Pending independent audit
        </div>

        <div className="icon-box mb-4 w-fit">
          <Shield className="h-6 w-6" strokeWidth={1.75} />
        </div>

        <p className="text-lg font-semibold text-[var(--color-fg)]">Audit status</p>
        <p className="mt-2 max-w-[16rem] text-base leading-relaxed text-[var(--color-fg-muted)]">
          Under active development. No independent security audit completed.
        </p>

        {/* Readiness checklist */}
        <div className="mt-auto space-y-2.5 border-t border-[var(--color-border)] pt-5">
          <StatusRow label="Zero-knowledge model" done />
          <StatusRow label="Open source (MIT)" done />
          <StatusRow label="Threat model documented" done />
          <StatusRow label="Third-party audit" done={false} />
        </div>

        <p className="mt-4 font-mono text-xs text-brand-500/50">review before prod · README</p>
      </div>
    </aside>
  );
}

function StatusRow({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      {done ? (
        <ShieldCheck className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" strokeWidth={2} />
      ) : (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-amber-500/40 text-[10px] text-amber-600 dark:text-amber-400">
          —
        </span>
      )}
      <span className={done ? "text-[var(--color-fg-muted)]" : "text-[var(--color-fg-subtle)]"}>
        {label}
      </span>
    </div>
  );
}
