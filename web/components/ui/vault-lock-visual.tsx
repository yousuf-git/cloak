import Image from "next/image";
import { cn } from "@/lib/utils";

interface VaultLockVisualProps {
  className?: string;
}

/**
 * Right-side visual for the download card — Cloak logo + vault lock motif.
 */
export function VaultLockVisual({ className }: VaultLockVisualProps) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden",
        className,
      )}
      aria-hidden
    >
      {/* Soft glow */}
      <div className="absolute h-48 w-48 rounded-full bg-brand-500/15 blur-3xl" />

      {/* Cipher ring */}
      <svg
        viewBox="0 0 200 200"
        className="absolute h-[220px] w-[220px] text-brand-500/20"
        fill="none"
      >
        <circle cx="100" cy="100" r="88" stroke="currentColor" strokeWidth="1" strokeDasharray="4 6" />
        <circle cx="100" cy="100" r="72" stroke="currentColor" strokeWidth="0.75" strokeDasharray="2 8" />
      </svg>

      {/* Main emblem */}
      <div className="relative flex flex-col items-center">
        <div className="relative">
          <div className="absolute -inset-3 rounded-2xl border border-brand-500/25 bg-brand-500/10" />
          <div className="relative flex h-28 w-28 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg shadow-brand-600/30">
            <Image
              src="/logo.svg"
              alt=""
              width={72}
              height={72}
              className="h-[4.5rem] w-[4.5rem]"
            />
          </div>

          {/* Lock badge */}
          <div className="absolute -bottom-2 -right-2 flex h-11 w-11 items-center justify-center rounded-xl border-2 border-[var(--color-bg)] bg-[var(--color-surface)] shadow-md">
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
              <circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none" />
            </svg>
          </div>
        </div>

        {/* Encryption labels */}
        <div className="mt-6 flex flex-col items-center gap-2">
          <span className="font-mono text-sm font-medium tracking-wide text-brand-600 dark:text-brand-300">
            zero-knowledge
          </span>
          <div className="flex flex-wrap justify-center gap-2">
            {["Argon2id", "XChaCha20", "dotenvx"].map((tag) => (
              <span
                key={tag}
                className="border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 font-mono text-xs text-[var(--color-fg-muted)]"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Corner cipher accents */}
      <span className="absolute top-4 right-6 font-mono text-[10px] text-brand-500/40">enc:v1</span>
      <span className="absolute bottom-6 left-4 font-mono text-[10px] text-brand-500/40">zk://vault</span>
    </div>
  );
}
