"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { SHOWCASE } from "@/content/site-content";
import { Reveal } from "@/components/motion/reveal";
import { ProductWindow } from "@/components/ui/product-window";
import { usePrefersReducedMotion } from "@/hooks/use-platform";

export function ShowcaseSection() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [40, -40]);

  return (
    <section id="showcase" className="section-pad">
      <div className="container-wide">
        <Reveal>
          <p className="text-xs font-medium tracking-[0.16em] text-[var(--color-fg-subtle)] uppercase">
            Product
          </p>
          <h2 className="mt-4 max-w-2xl text-balance text-3xl font-semibold tracking-[-0.03em] sm:text-4xl lg:text-[2.75rem] lg:leading-[1.15]">
            A native vault that feels quiet and precise.
          </h2>
        </Reveal>

        <div ref={ref} className="mt-16 lg:mt-20">
          <motion.div style={{ y }} className="relative mx-auto max-w-4xl">
            <ProductWindow className="w-full" />
          </motion.div>
        </div>

        <div className="mt-20 grid gap-12 border-t border-[var(--color-border)] pt-16 sm:grid-cols-3 sm:gap-8 lg:mt-28 lg:pt-20">
          {SHOWCASE.map((item, i) => (
            <Reveal key={item.title} delay={i * 0.08}>
              <div>
                <p className="font-mono text-xs text-[var(--color-fg-subtle)]">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-3 text-lg font-semibold tracking-tight">{item.title}</h3>
                <p className="mt-3 leading-relaxed text-[var(--color-fg-muted)]">{item.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
