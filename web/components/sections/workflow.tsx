"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { WORKFLOW_STEPS } from "@/content/site-content";
import { Reveal } from "@/components/motion/reveal";
import { LottiePlayer } from "@/components/ui/lottie-player";
import { LOTTIE_ONCE } from "@/lib/lottie-once";
import { SealGif, StoreGif, RevealGif } from "@/components/ui/workflow-gifs";
import { usePrefersReducedMotion } from "@/hooks/use-platform";

export function WorkflowSection() {
  const trackRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start end", "end start"],
  });
  const x = useTransform(scrollYProgress, [0.15, 0.85], ["0%", reduced ? "0%" : "-35%"]);

  return (
    <section id="workflow" className="section-pad border-y border-[var(--color-border)] bg-[var(--color-surface-2)]/50">
      <div className="container-wide">
        <Reveal>
          <p className="text-xs font-medium tracking-[0.16em] text-[var(--color-fg-subtle)] uppercase">
            How it works
          </p>
          <h2 className="mt-4 max-w-2xl text-balance text-3xl font-semibold tracking-[-0.03em] sm:text-4xl lg:text-[2.75rem] lg:leading-[1.15]">
            From master password to opaque blob.
          </h2>
          <p className="mt-5 max-w-lg text-lg text-[var(--color-fg-muted)]">
            A horizontal story of local cryptography — scroll to walk the path secrets take.
          </p>
        </Reveal>
      </div>

      <div ref={trackRef} className="mt-16 overflow-hidden lg:mt-20">
        <motion.div
          style={{ x }}
          className="flex w-max gap-8 px-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))] lg:gap-12"
        >
          {WORKFLOW_STEPS.map((step, i) => (
            <article
              key={step.step}
              className="flex w-[min(85vw,22rem)] shrink-0 flex-col sm:w-[24rem]"
            >
              <span className="font-mono text-sm text-[var(--color-fg-subtle)]">{step.step}</span>
              <h3 className="mt-4 text-2xl font-semibold tracking-tight">{step.title}</h3>
              <p className="mt-3 text-[1.0625rem] leading-relaxed text-[var(--color-fg-muted)]">
                {step.body}
              </p>
              <div className="mt-8 w-[11rem] sm:w-[13rem]">
                {i === 0 && (
                  <div className="aspect-square w-full">
                    <LottiePlayer src={LOTTIE_ONCE.derive} className="h-full w-full" speed={0.85} />
                  </div>
                )}
                {i === 1 && <SealGif />}
                {i === 2 && <StoreGif />}
                {i === 3 && <RevealGif />}
              </div>
            </article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
