import { SectionGlow } from "@/components/ui/section-glow";
import { cn } from "@/lib/utils";

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
}: SectionProps) {
  return (
    <section
      id={id}
      className={cn(
        "relative py-20 sm:py-24",
        alt && "border-y border-[var(--color-border)] bg-[var(--color-surface)]",
        className,
      )}
    >
      <SectionGlow variant={accent ? "accent" : alt ? "alt" : "default"} />
      <div className="container-wide relative">
        <header
          className={cn(
            "mb-12 max-w-3xl",
            headerAlign === "center" && "mx-auto text-center",
          )}
        >
          {label && (
            <p className="section-label mb-3">
              {icon}
              {label}
            </p>
          )}
          <h2 className="font-semibold tracking-tight text-[var(--color-fg)]">{title}</h2>
          {description && (
            <p className="mt-4 text-lg leading-relaxed text-[var(--color-fg-muted)]">{description}</p>
          )}
        </header>
        {children}
      </div>
    </section>
  );
}
