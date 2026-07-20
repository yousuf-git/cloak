"use client";

import { cn } from "@/lib/utils";
import { LottiePlayer } from "@/components/ui/lottie-player";

interface SectionVisualProps {
  src: string;
  caption?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  speed?: number;
}

const SIZE = {
  sm: "max-w-[140px]",
  md: "max-w-[220px]",
  lg: "max-w-[320px]",
} as const;

/** Borderless Lottie — blends into the layout, never boxed */
export function SectionVisual({
  src,
  caption,
  className,
  size = "md",
  speed = 0.85,
}: SectionVisualProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center", className)}>
      <div className={cn("relative aspect-square w-full", SIZE[size])}>
        <LottiePlayer src={src} className="h-full w-full" speed={speed} />
      </div>
      {caption && (
        <p className="mt-3 text-center font-mono text-xs tracking-wide text-[var(--color-fg-subtle)]">
          {caption}
        </p>
      )}
    </div>
  );
}
