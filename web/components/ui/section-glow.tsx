import { cn } from "@/lib/utils";

interface SectionGlowProps {
  variant?: "default" | "alt" | "accent";
  className?: string;
}

/** Subtle section background wash — no tiled patterns */
export function SectionGlow({ variant = "default", className }: SectionGlowProps) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      {variant === "alt" && (
        <>
          <div className="absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_70%_80%_at_50%_0%,rgba(45,106,79,0.08),transparent)] dark:bg-[radial-gradient(ellipse_70%_80%_at_50%_0%,rgba(45,106,79,0.12),transparent)]" />
          <div className="absolute -right-32 top-1/3 h-64 w-64 rounded-full bg-brand-500/6 blur-3xl" />
        </>
      )}
      {variant === "accent" && (
        <>
          <div className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(45,106,79,0.14),transparent)] dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(45,106,79,0.18),transparent)]" />
          <div className="absolute bottom-0 left-1/4 h-48 w-48 rounded-full bg-brand-600/8 blur-3xl" />
        </>
      )}
    </div>
  );
}
