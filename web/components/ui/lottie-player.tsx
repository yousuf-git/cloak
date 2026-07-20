"use client";

import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { usePrefersReducedMotion } from "@/hooks/use-platform";
import { cn } from "@/lib/utils";

interface LottiePlayerProps {
  src: string;
  className?: string;
  loop?: boolean;
  speed?: number;
}

export function LottiePlayer({
  src,
  className,
  loop = true,
  speed = 1,
}: LottiePlayerProps) {
  const reduced = usePrefersReducedMotion();

  return (
    <div className={cn("relative", className)} aria-hidden>
      <DotLottieReact
        src={src}
        loop={loop && !reduced}
        autoplay={!reduced}
        speed={speed}
        className="h-full w-full"
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
