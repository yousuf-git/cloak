import { cn } from "@/lib/utils";
import { SectionGlow } from "@/components/ui/section-glow";

interface SectionProps {
  id?: string;
  label?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  alt?: boolean;
  accent?: boolean;
  className?: string;
  icon?: React.ReactNode;
  headerAlign?: "left" | "center";
  visual?: React.ReactNode;
}

export function Section({
  id,
  label,
  title,
  description,
  children,
  alt = false,
  accent = false,
  className,
  icon,
  headerAlign = "left",
  visual,
}: SectionProps) {
  return (
    <section
      id={id}
      className={cn(
        "relative py-16 sm:py-20",
        alt && "border-y border-[var(--color-border)] bg-[var(--color-surface-2)]/60",
        className,
      )}
    >
      <SectionGlow variant={accent ? "accent" : alt ? "alt" : "default"} />
      <div className="container-wide relative">
        <header
          className={cn(
            "mb-10",
            visual ? "grid items-center gap-8 lg:grid-cols-[1fr_auto]" : "max-w-2xl",
            headerAlign === "center" && !visual && "mx-auto text-center",
          )}
        >
          <div className={cn(headerAlign === "center" && !visual && "mx-auto")}>
            {label && (
              <p className="section-label mb-3">
                {icon}
                {label}
              </p>
            )}
            <h2 className="text-3xl font-bold tracking-tight text-[var(--color-fg)] sm:text-4xl">
              {title}
            </h2>
            {description && (
              <p className="mt-3 max-w-2xl text-lg leading-relaxed text-[var(--color-fg-muted)]">
                {description}
              </p>
            )}
          </div>
          {visual && <div className="hidden justify-end lg:flex">{visual}</div>}
        </header>
        {children}
      </div>
    </section>
  );
}
