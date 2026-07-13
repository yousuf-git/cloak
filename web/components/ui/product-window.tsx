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
    <div className={cn("panel overflow-hidden shadow-md", className)}>
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>
        <span className="flex-1 text-center font-mono text-sm text-[var(--color-fg-subtle)]">
          Cloak — production.env
        </span>
        <Lock className="h-4 w-4 text-brand-600 dark:text-brand-400" />
      </div>

      <div className={cn("grid", compact ? "grid-cols-[160px_1fr]" : "grid-cols-[190px_1fr]")}>
        <aside className="border-r border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <div className="mb-4 flex items-center gap-2 px-2 py-1">
            <Image src="/logo.svg" alt="" width={20} height={20} />
            <span className="text-sm font-semibold">Cloak</span>
          </div>
          <nav className="space-y-0.5">
            {VAULT_MODULES.map((item, i) => (
              <div
                key={item}
                className={cn(
                  "px-2.5 py-1.5 text-sm",
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

        <main className="bg-[var(--color-bg)] p-4">
          <div className="mb-4 flex items-center justify-between border-b border-[var(--color-border)] pb-3">
            <div>
              <p className="text-base font-semibold">production.env</p>
              <p className="text-sm text-[var(--color-fg-subtle)]">api-service · dotenvx</p>
            </div>
            <span className="inline-flex items-center gap-1.5 border border-brand-500/25 bg-brand-500/10 px-2.5 py-1 font-mono text-sm text-brand-700 dark:text-brand-300">
              <Lock className="h-3.5 w-3.5" />
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
                className="flex items-center justify-between border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
              >
                <span className="font-mono text-sm text-[var(--color-fg)]">{row.key}</span>
                <span className="font-mono text-sm text-[var(--color-fg-subtle)]">{row.value}</span>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
