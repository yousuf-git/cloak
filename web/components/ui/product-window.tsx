import Image from "next/image";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { VAULT_MODULES } from "@/content/site-content";

interface ProductWindowProps {
  className?: string;
  compact?: boolean;
}

export function ProductWindow({ className, compact = false }: ProductWindowProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-3">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-border-strong)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-border-strong)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-border-strong)]" />
        </div>
        <span className="flex-1 text-center font-mono text-xs text-[var(--color-fg-subtle)]">
          Cloak — production.env
        </span>
        <Lock className="h-3.5 w-3.5 text-[var(--color-fg-subtle)]" />
      </div>

      <div className={cn("grid", compact ? "grid-cols-[140px_1fr]" : "grid-cols-[1fr] sm:grid-cols-[180px_1fr]")}>
        <aside className="hidden border-r border-[var(--color-border)] bg-[var(--color-bg)] p-4 sm:block">
          <div className="mb-5 flex items-center gap-2 px-1">
            <Image
              src="/logo.png"
              alt=""
              width={18}
              height={18}
              className="h-[18px] w-[18px] rounded-full"
            />
            <span className="text-sm font-semibold tracking-tight">Cloak</span>
          </div>
          <nav className="space-y-0.5">
            {VAULT_MODULES.map((item, i) => (
              <div
                key={item}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-sm",
                  i === 2
                    ? "bg-[var(--color-surface-2)] font-medium text-[var(--color-fg)]"
                    : "text-[var(--color-fg-muted)]",
                )}
              >
                {item}
              </div>
            ))}
          </nav>
        </aside>

        <main className="bg-[var(--color-bg)] p-4 sm:p-5">
          <div className="mb-5 flex items-start justify-between gap-4 border-b border-[var(--color-border)] pb-4">
            <div>
              <p className="font-medium tracking-tight">production.env</p>
              <p className="mt-0.5 font-mono text-xs text-[var(--color-fg-subtle)]">
                api-service · dotenvx
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-2.5 py-1 font-mono text-[0.6875rem] text-[var(--color-fg-muted)]">
              <Lock className="h-3 w-3" />
              encrypted
            </span>
          </div>

          <div className="space-y-2">
            {[
              { key: "DATABASE_URL", value: "enc:v1:a8f3…c21d" },
              { key: "STRIPE_SECRET", value: "enc:v1:9b2e…f04a" },
              { key: "JWT_SECRET", value: "enc:v1:4c7d…8e91" },
              { key: "REDIS_URL", value: "enc:v1:1f6a…3b72" },
            ].map((row) => (
              <div
                key={row.key}
                className="flex items-center justify-between gap-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5"
              >
                <span className="font-mono text-xs text-[var(--color-fg)] sm:text-sm">{row.key}</span>
                <span className="font-mono text-xs text-[var(--color-fg-subtle)] sm:text-sm">
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
