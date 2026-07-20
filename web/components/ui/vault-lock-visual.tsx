"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface VaultLockVisualProps {
  className?: string;
}

/** Static brand mark — does not reuse landing Lotties */
export function VaultLockVisual({ className }: VaultLockVisualProps) {
  return (
    <div className={cn("flex items-center justify-center", className)} aria-hidden>
      <Image
        src="/logo.png"
        alt=""
        width={120}
        height={120}
        className="h-[7.5rem] w-[7.5rem] rounded-full"
      />
    </div>
  );
}
