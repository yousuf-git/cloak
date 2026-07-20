"use client";

import { FINAL_CTA } from "@/content/site-content";
import { SITE } from "@/constants/site";
import { Reveal } from "@/components/motion/reveal";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { DownloadRow } from "@/components/ui/download-button";
import { LottiePlayer } from "@/components/ui/lottie-player";
import { LOTTIE_ONCE } from "@/lib/lottie-once";
import type { GitHubRelease } from "@/types/github";

interface FinalCTAProps {
  release: GitHubRelease | null;
}

/** Always-dark band — fixed colors so light/dark theme tokens don't invert contrast */
export function FinalCTA({ release }: FinalCTAProps) {
  return (
    <section
      id="download"
      className="relative overflow-hidden border-t border-[#1f1f1c] bg-[#111110] text-[#fafaf9]"
    >
      <div className="pointer-events-none absolute inset-0 noise opacity-30" aria-hidden />

      <div className="container-wide relative section-pad">
        <div className="grid items-center gap-16 lg:grid-cols-[1.2fr_0.8fr]">
          <Reveal>
            <h2 className="font-display text-4xl tracking-tight text-[#fafaf9] sm:text-5xl lg:text-6xl xl:text-7xl">
              {FINAL_CTA.title}
            </h2>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-[#fafaf9]/65">
              {FINAL_CTA.body}
            </p>

            <div className="mt-10">
              <DownloadRow
                release={release}
                inverted
                className="flex flex-col items-start"
              />
            </div>

            <div className="mt-6">
              <MagneticButton
                href={SITE.repo}
                variant="secondary"
                size="lg"
                external
                className="border-white/25 text-[#fafaf9] hover:border-white hover:bg-white/5"
              >
                Explore the repository
              </MagneticButton>
            </div>
          </Reveal>

          <Reveal delay={0.1} className="mx-auto hidden w-full max-w-xs lg:block">
            <div className="aspect-square w-full invert">
              <LottiePlayer src={LOTTIE_ONCE.cta} className="h-full w-full" speed={0.85} />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
