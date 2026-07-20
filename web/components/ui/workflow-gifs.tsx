"use client";

import { motion } from "motion/react";
import { usePrefersReducedMotion } from "@/hooks/use-platform";
import { cn } from "@/lib/utils";

const C = {
  blue: "#146EF5",
  blueSoft: "#D6E6FF",
  blueMid: "#3B8EFF",
  teal: "#1FC8DB",
  green: "#0D9488",
  orange: "#F59E0B",
  purple: "#7C3AED",
  ink: "#0F172A",
} as const;

function Stage({
  className,
  children,
  caption,
  captionColor,
}: {
  className?: string;
  children: React.ReactNode;
  caption: string;
  captionColor: string;
}) {
  return (
    <div className={cn("relative aspect-square w-full", className)} aria-hidden>
      <div className="flex h-full w-full flex-col items-center justify-center">
        {children}
        <p
          className="mt-1 font-mono text-[0.65rem] font-medium tracking-wide"
          style={{ color: captionColor }}
        >
          {caption}
        </p>
      </div>
    </div>
  );
}

/** Workflow 02 — seal / encrypt before network */
export function SealGif({ className }: { className?: string }) {
  const reduced = usePrefersReducedMotion();

  return (
    <Stage className={className} caption="XChaCha20 · sealed" captionColor={C.blue}>
      <svg viewBox="0 0 160 160" className="h-[78%] w-[78%]">
        <motion.circle
          cx="80"
          cy="88"
          r="54"
          fill={C.blueSoft}
          animate={reduced ? undefined : { opacity: [0.5, 0.85, 0.5] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.g
          animate={reduced ? undefined : { y: [0, -10, 0] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <path
            d="M58 72 V52 a22 22 0 0 1 44 0 V72"
            fill="none"
            stroke={C.blueMid}
            strokeWidth="7"
            strokeLinecap="round"
          />
        </motion.g>
        <rect x="48" y="72" width="64" height="52" rx="12" fill={C.blue} />
        <circle cx="80" cy="94" r="7" fill="#fff" />
        <rect x="77" y="94" width="6" height="16" rx="2" fill="#fff" />
        <motion.circle
          cx="80"
          cy="88"
          r="58"
          fill="none"
          stroke={C.teal}
          strokeWidth="2"
          strokeDasharray="6 8"
          animate={reduced ? undefined : { rotate: 360, opacity: [0.35, 0.8, 0.35] }}
          transition={{
            rotate: { duration: 8, repeat: Infinity, ease: "linear" },
            opacity: { duration: 2.8, repeat: Infinity, ease: "easeInOut" },
          }}
          style={{ transformOrigin: "80px 88px" }}
        />
      </svg>
    </Stage>
  );
}

/** Workflow 03 — opaque blob stored on API */
export function StoreGif({ className }: { className?: string }) {
  const reduced = usePrefersReducedMotion();

  return (
    <Stage className={className} caption="opaque · server-side" captionColor={C.purple}>
      <svg viewBox="0 0 160 160" className="h-[78%] w-[78%]">
        <motion.g
          animate={reduced ? undefined : { x: [0, 34, 34], opacity: [1, 1, 0.4] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", times: [0, 0.55, 1] }}
        >
          <rect x="24" y="66" width="44" height="30" rx="8" fill={C.purple} />
          <text
            x="46"
            y="86"
            textAnchor="middle"
            fill="#fff"
            style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", fontWeight: 600 }}
          >
            blob
          </text>
        </motion.g>

        <motion.path
          d="M74 81 H98"
          stroke={C.teal}
          strokeWidth="3"
          strokeLinecap="round"
          animate={reduced ? undefined : { opacity: [0.25, 1, 0.25] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.path
          d="M94 74 L104 81 L94 88"
          fill="none"
          stroke={C.teal}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={reduced ? undefined : { opacity: [0.25, 1, 0.25] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        />

        <rect x="108" y="48" width="38" height="66" rx="8" fill={C.blue} />
        <line x1="116" y1="64" x2="138" y2="64" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />
        <line x1="116" y1="76" x2="138" y2="76" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />
        <motion.circle
          cx="127"
          cy="98"
          r="5"
          fill={C.orange}
          animate={reduced ? undefined : { opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        />
      </svg>
    </Stage>
  );
}

/** Workflow 04 — reveal on demand */
export function RevealGif({ className }: { className?: string }) {
  const reduced = usePrefersReducedMotion();

  return (
    <Stage className={className} caption="reveal · one field" captionColor={C.orange}>
      <svg viewBox="0 0 160 160" className="h-[78%] w-[78%]">
        <rect x="24" y="48" width="112" height="52" rx="12" fill="#fff" stroke={C.blue} strokeWidth="3" />
        <text
          x="38"
          y="68"
          fill={C.blueMid}
          style={{ fontSize: 8, fontFamily: "ui-monospace, monospace", fontWeight: 600 }}
        >
          SECRET
        </text>
        <motion.text
          x="38"
          y="86"
          fill={C.ink}
          style={{ fontSize: 12, fontFamily: "ui-monospace, monospace", letterSpacing: "0.12em" }}
          animate={reduced ? undefined : { opacity: [1, 1, 0, 0, 1] }}
          transition={{ duration: 3.2, repeat: Infinity, times: [0, 0.35, 0.4, 0.75, 0.8] }}
        >
          ••••••••••••
        </motion.text>
        <motion.text
          x="38"
          y="86"
          fill={C.green}
          style={{ fontSize: 11, fontFamily: "ui-monospace, monospace", fontWeight: 600 }}
          animate={reduced ? undefined : { opacity: [0, 0, 1, 1, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, times: [0, 0.35, 0.4, 0.75, 0.8] }}
        >
          sk_live_51…
        </motion.text>

        <motion.g
          animate={reduced ? undefined : { scale: [1, 1.08, 1] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "80px 128px" }}
        >
          <ellipse cx="80" cy="128" rx="22" ry="12" fill={C.blueSoft} stroke={C.blue} strokeWidth="3" />
          <circle cx="80" cy="128" r="6" fill={C.blue} />
          <circle cx="82" cy="126" r="2" fill="#fff" />
        </motion.g>
      </svg>
    </Stage>
  );
}
