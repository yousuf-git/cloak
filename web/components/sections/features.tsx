"use client";

import { FEATURE_BLOCKS } from "@/content/site-content";
import { Reveal } from "@/components/motion/reveal";
import { LottiePlayer } from "@/components/ui/lottie-player";
import { LOTTIE_ONCE } from "@/lib/lottie-once";
import { RecoveryGif } from "@/components/ui/recovery-gif";

const FEATURE_ANIM: Record<string, string> = {
  crypto: LOTTIE_ONCE.crypto,
  dotenvx: LOTTIE_ONCE.dotenvx,
  reveal: LOTTIE_ONCE.exposure,
};

export function FeaturesSection() {
  return (
    <section id="features" className="section-pad">
      <div className="container-wide">
        <Reveal>
          <p className="text-xs font-medium tracking-[0.16em] text-[var(--color-fg-subtle)] uppercase">
            Features
          </p>
          <h2 className="mt-4 max-w-2xl text-balance text-3xl font-semibold tracking-[-0.03em] sm:text-4xl lg:text-[2.75rem] lg:leading-[1.15]">
            Engineered for developers who refuse to trust the cloud with keys.
          </h2>
        </Reveal>

        <div className="mt-20 space-y-0 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)] lg:mt-28">
          {FEATURE_BLOCKS.map((block, i) => {
            const reverse = i % 2 === 1;
            const anim = FEATURE_ANIM[block.id];
            return (
              <Reveal key={block.id}>
                <article
                  className={`grid items-center gap-10 py-16 lg:grid-cols-2 lg:gap-20 lg:py-24 ${
                    reverse ? "lg:[&>*:first-child]:order-2" : ""
                  }`}
                >
                  <div>
                    <p className="text-xs font-medium tracking-[0.14em] text-[var(--color-fg-subtle)] uppercase">
                      {block.label}
                    </p>
                    <h3 className="mt-4 text-2xl font-semibold tracking-[-0.025em] sm:text-3xl lg:text-[2.15rem] lg:leading-[1.2]">
                      {block.title}
                    </h3>
                    <p className="mt-5 max-w-md text-lg leading-relaxed text-[var(--color-fg-muted)]">
                      {block.body}
                    </p>
                    <p className="mt-6 font-mono text-xs tracking-wide text-[var(--color-fg-subtle)]">
                      {block.detail}
                    </p>
                  </div>
                  <div className="mx-auto flex aspect-square w-full max-w-[280px] items-center justify-center sm:max-w-[320px]">
                    {block.id === "recovery" ? (
                      <RecoveryGif className="w-full" />
                    ) : (
                      anim && (
                        <LottiePlayer src={anim} className="h-full w-full" speed={0.85} />
                      )
                    )}
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
