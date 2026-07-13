import { cn } from "@/lib/utils";

interface SecurityBackdropProps {
  className?: string;
  variant?: "hero" | "section";
}

/** Clean hero/section background — no tiled patterns */
export function SecurityBackdrop({ className, variant = "hero" }: SecurityBackdropProps) {
  if (variant === "hero") {
    return (
      <div
        className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
        aria-hidden
      >
        {/* Top spotlight — visible forest-green wash */}
        <div className="absolute inset-x-0 top-0 h-[min(75vh,600px)] bg-[radial-gradient(ellipse_90%_70%_at_50%_-10%,rgba(45,106,79,0.22),transparent)] dark:bg-[radial-gradient(ellipse_90%_70%_at_50%_-10%,rgba(45,106,79,0.32),transparent)]" />

        {/* Soft side accents */}
        <div className="absolute -top-16 left-[20%] h-80 w-80 rounded-full bg-brand-400/15 blur-3xl dark:bg-brand-500/20" />
        <div className="absolute top-24 right-[18%] h-72 w-72 rounded-full bg-brand-600/12 blur-3xl dark:bg-brand-600/18" />

        {/* Bottom fade into page */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[var(--color-bg)] to-transparent" />
      </div>
    );
  }

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      aria-hidden
    >
      <div className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500/8 blur-3xl" />
    </div>
  );
}

interface CryptoBadgeProps {
  label: string;
  icon?: React.ReactNode;
}

export function CryptoBadge({ label, icon }: CryptoBadgeProps) {
  return (
    <span className="inline-flex items-center gap-2 border border-brand-500/25 bg-brand-500/10 px-3 py-1.5 text-sm font-medium text-brand-700 dark:text-brand-300">
      {icon}
      {label}
    </span>
  );
}
