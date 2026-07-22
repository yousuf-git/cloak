"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { HERO, TRUST_LINE } from "@/content/site-content";
import { DownloadRow } from "@/components/ui/download-button";
import { LOTTIE_ONCE } from "@/lib/lottie-once";
import { LottiePlayer } from "@/components/ui/lottie-player";
import { usePrefersReducedMotion } from "@/hooks/use-platform";
import type { GitHubRelease } from "@/types/github";

interface HeroProps {
  release: GitHubRelease | null;
}

export function Hero({ release }: HeroProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const lottieY = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : 80]);
  const lottieOpacity = useTransform(scrollYProgress, [0, 0.85], [1, reduced ? 1 : 0.35]);

  return (
    <section ref={sectionRef} className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 noise opacity-60" aria-hidden />
      <div
        className="pointer-events-none absolute -top-32 left-1/2 h-[28rem] w-[40rem] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(26,58,47,0.06),transparent_70%)]"
        aria-hidden
      />

      <div className="container-wide relative pt-10 pb-12 sm:pt-14 sm:pb-14 lg:pt-16 lg:pb-16">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <div className="flex flex-col text-center lg:text-left">
            <motion.p
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="font-display text-5xl tracking-tight text-[var(--color-fg)] sm:text-6xl lg:text-7xl"
            >
              {HERO.brand}
            </motion.p>

            <motion.h1
              initial={reduced ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="mt-4 text-balance text-[2.1rem] leading-[1.12] font-semibold tracking-[-0.035em] text-[var(--color-fg)] sm:text-4xl lg:text-[2.75rem] lg:leading-[1.15]"
            >
              {HERO.headline}
            </motion.h1>

            <motion.p
              initial={reduced ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto mt-4 max-w-lg text-lg leading-relaxed text-[var(--color-fg-muted)] lg:mx-0"
            >
              {HERO.subhead}
            </motion.p>

            <motion.div
              initial={reduced ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="mt-7 flex w-full flex-col items-center gap-4 lg:items-start"
            >
              <DownloadRow release={release} className="flex flex-col items-center lg:items-start" />
            </motion.div>

            <motion.p
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="mt-6 text-sm text-[var(--color-fg-subtle)]"
            >
              {TRUST_LINE}
            </motion.p>
          </div>

          <motion.div
            style={{ y: lottieY, opacity: lottieOpacity }}
            className="relative mx-auto w-full max-w-md lg:max-w-none"
          >
            <motion.div
              initial={reduced ? false : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
              className="relative aspect-square w-full"
            >
              <LottiePlayer src={LOTTIE_ONCE.hero} className="h-full w-full" speed={0.85} />
            </motion.div>
            <p className="mt-2 text-center font-mono text-xs tracking-wide text-[var(--color-fg-subtle)]">
              Encrypted on-device · synced as ciphertext
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
