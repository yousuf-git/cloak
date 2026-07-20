"use client";

import { useRef } from "react";
import { motion, useInView, type Variants } from "motion/react";
import { usePrefersReducedMotion } from "@/hooks/use-platform";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease },
  },
};

const fade: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.6, ease },
  },
};

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  variant?: "up" | "fade";
  once?: boolean;
}

export function Reveal({
  children,
  className,
  delay = 0,
  variant = "up",
  once = true,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.2, once });
  const reduced = usePrefersReducedMotion();
  const variants = variant === "fade" ? fade : fadeUp;

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={variants}
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface StaggerProps {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
}

export function Stagger({ children, className, stagger = 0.08 }: StaggerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.15, once: true });
  const reduced = usePrefersReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: stagger } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={fadeUp} className={className}>
      {children}
    </motion.div>
  );
}

interface TextRevealProps {
  text: string;
  as?: "h1" | "h2" | "h3" | "p";
  className?: string;
  delay?: number;
}

export function TextReveal({ text, as = "h2", className, delay = 0 }: TextRevealProps) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { amount: 0.4, once: true });
  const reduced = usePrefersReducedMotion();
  const Tag = motion[as];

  if (reduced) {
    const Static = as;
    return <Static className={className}>{text}</Static>;
  }

  return (
    <Tag
      ref={ref as never}
      className={cn("overflow-hidden", className)}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      aria-label={text}
    >
      <motion.span
        className="block"
        variants={{
          hidden: { y: "110%" },
          visible: {
            y: "0%",
            transition: { duration: 0.85, ease, delay },
          },
        }}
      >
        {text}
      </motion.span>
    </Tag>
  );
}
