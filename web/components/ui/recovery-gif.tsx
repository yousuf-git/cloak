"use client";

import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-platform";
import { cn } from "@/lib/utils";

/** Webflow-inspired colorful palette */
const C = {
  blue: "#146EF5",
  blueSoft: "#D6E6FF",
  blueMid: "#3B8EFF",
  teal: "#1FC8DB",
  green: "#0D9488",
} as const;

/** Features · Account recovery — colorful Webflow-style motion */
export function RecoveryGif({ className }: { className?: string }) {
  const reduced = usePrefersReducedMotion();
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setPhase((p) => (p + 1) % 3), 2200);
    return () => clearInterval(id);
  }, [reduced]);

  const labels = ["recovery key", "re-wrap DEK", "vault restored"] as const;
  const labelColors = [C.blue, C.teal, C.green] as const;

  return (
    <div
      className={cn(
        "relative flex aspect-square w-full flex-col items-center justify-center",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 200 200" className="h-[78%] w-[78%]">
        {/* soft glow disc */}
        <motion.circle
          cx="100"
          cy="100"
          r="62"
          fill={C.blueSoft}
          animate={reduced ? undefined : { opacity: [0.45, 0.75, 0.45] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* wrap ring */}
        <motion.rect
          x="42"
          y="42"
          width="116"
          height="116"
          rx="20"
          fill="none"
          stroke={phase === 1 ? C.teal : C.blueMid}
          strokeWidth="2.5"
          strokeDasharray="8 6"
          animate={
            reduced
              ? undefined
              : {
                  opacity: phase === 1 ? [0.4, 1, 0.4] : 0.35,
                  rotate: phase === 1 ? [0, 360] : 0,
                }
          }
          transition={
            phase === 1
              ? { duration: 4, repeat: Infinity, ease: "linear", opacity: { duration: 1.6, repeat: Infinity } }
              : { duration: 0.4 }
          }
          style={{ transformOrigin: "100px 100px" }}
        />

        {/* key */}
        <motion.g
          animate={reduced ? undefined : { rotate: phase === 0 ? [0, -10, 0] : 0 }}
          transition={{ duration: 1.6, ease: "easeInOut" }}
          style={{ transformOrigin: "72px 100px" }}
        >
          <circle cx="72" cy="100" r="30" fill={C.blue} />
          <circle cx="72" cy="100" r="12" fill="#fff" />
          <circle cx="72" cy="100" r="5" fill={C.teal} />
          <rect x="98" y="93" width="62" height="14" rx="5" fill={C.blueMid} />
          <rect x="144" y="93" width="10" height="24" rx="3" fill={C.teal} />
          <rect x="158" y="93" width="10" height="18" rx="3" fill={C.green} />
        </motion.g>

        {/* success check */}
        <motion.g
          initial={false}
          animate={{ opacity: phase === 2 ? 1 : 0, scale: phase === 2 ? 1 : 0.7 }}
          transition={{ duration: 0.4 }}
          style={{ transformOrigin: "100px 100px" }}
        >
          <circle cx="148" cy="58" r="18" fill={C.green} />
          <path
            d="M139 58 L146 65 L159 50"
            fill="none"
            stroke="#fff"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </motion.g>
      </svg>

      <AnimatePresence mode="wait">
        <motion.p
          key={labels[phase]}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="font-mono text-[0.75rem] font-medium tracking-wide"
          style={{ color: labelColors[phase] }}
        >
          {labels[phase]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
