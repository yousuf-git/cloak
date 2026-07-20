"use client";

import { useRef } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
import Link from "next/link";
import { usePrefersReducedMotion } from "@/hooks/use-platform";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg" | "xl";

interface MagneticButtonProps {
  children: React.ReactNode;
  href?: string;
  external?: boolean;
  variant?: Variant;
  size?: Size;
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  "aria-label"?: string;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--color-fg)] text-[var(--color-bg)] hover:bg-brand-600 dark:bg-[var(--color-fg)] dark:text-[var(--color-bg)] dark:hover:bg-brand-400",
  secondary:
    "bg-transparent text-[var(--color-fg)] border border-[var(--color-border-strong)] hover:border-[var(--color-fg)] hover:bg-[var(--color-surface)]",
  ghost: "bg-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-[0.9375rem]",
  lg: "h-12 px-7 text-base",
  xl: "h-14 px-9 text-lg",
};

export function MagneticButton({
  children,
  href,
  external,
  variant = "primary",
  size = "md",
  className,
  onClick,
  type = "button",
  "aria-label": ariaLabel,
}: MagneticButtonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 280, damping: 22, mass: 0.4 });
  const springY = useSpring(y, { stiffness: 280, damping: 22, mass: 0.4 });

  const onMove = (e: React.MouseEvent) => {
    if (reduced || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    x.set(dx * 0.22);
    y.set(dy * 0.22);
  };

  const onLeave = () => {
    x.set(0);
    y.set(0);
  };

  const classes = cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-tight transition-colors duration-300",
    variants[variant],
    sizes[size],
    className,
  );

  const inner = (
    <motion.span style={reduced ? undefined : { x: springX, y: springY }} className="inline-flex items-center gap-2">
      {children}
    </motion.span>
  );

  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} className="inline-flex">
      {href ? (
        <Link
          href={href}
          className={classes}
          aria-label={ariaLabel}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {inner}
        </Link>
      ) : (
        <button type={type} onClick={onClick} className={classes} aria-label={ariaLabel}>
          {inner}
        </button>
      )}
    </div>
  );
}
