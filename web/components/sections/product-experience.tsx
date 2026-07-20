"use client";

import { PRODUCT_EXPERIENCE } from "@/content/site-content";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { LOTTIE_ONCE } from "@/lib/lottie-once";
import { LottiePlayer } from "@/components/ui/lottie-player";

export function ProductExperienceSection() {
  return (
    <section id="product" className="section-pad">
      <div className="container-wide">
        <div className="grid items-center gap-16 lg:grid-cols-2 lg:gap-24">
          <div>
            <Reveal>
              <p className="text-xs font-medium tracking-[0.16em] text-[var(--color-fg-subtle)] uppercase">
                {PRODUCT_EXPERIENCE.label}
              </p>
              <h2 className="mt-4 max-w-xl text-balance text-3xl font-semibold tracking-[-0.03em] sm:text-4xl lg:text-[2.75rem] lg:leading-[1.15]">
                {PRODUCT_EXPERIENCE.title}
              </h2>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-[var(--color-fg-muted)]">
                {PRODUCT_EXPERIENCE.body}
              </p>
            </Reveal>

            <Stagger className="mt-12 space-y-10" stagger={0.1}>
              {PRODUCT_EXPERIENCE.points.map((point, i) => (
                <StaggerItem key={point.title}>
                  <div className="flex gap-5">
                    <span className="font-mono text-sm text-[var(--color-fg-subtle)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3 className="text-lg font-semibold tracking-tight">{point.title}</h3>
                      <p className="mt-2 max-w-sm leading-relaxed text-[var(--color-fg-muted)]">
                        {point.body}
                      </p>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>

          <Reveal delay={0.1} className="relative">
            <div className="mx-auto aspect-square w-full max-w-md lg:max-w-lg">
              <LottiePlayer src={LOTTIE_ONCE.product} className="h-full w-full" speed={0.8} />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
