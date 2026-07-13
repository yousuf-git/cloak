import Link from "next/link";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  href?: string;
  external?: boolean;
  icon?: React.ReactNode;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 border border-brand-700 dark:bg-brand-600 dark:hover:bg-brand-700",
  secondary:
    "bg-[var(--color-bg)] text-[var(--color-fg)] border border-[var(--color-border-strong)] hover:bg-[var(--color-surface)]",
  ghost: "bg-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:underline",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-10 px-4 text-base",
  md: "h-11 px-5 text-base",
  lg: "h-12 px-6 text-lg",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  href,
  external,
  icon,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(
    "inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
    variants[variant],
    sizes[size],
    className,
  );

  if (href) {
    return (
      <Link
        href={href}
        className={classes}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {children}
        {icon}
      </Link>
    );
  }

  return (
    <button type="button" className={classes} {...props}>
      {children}
      {icon}
    </button>
  );
}
