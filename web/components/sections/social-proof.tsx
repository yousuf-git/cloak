"use client";

import { SOCIAL_PROOF } from "@/content/site-content";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";

export function SocialProofSection() {
  return (
    <section className="border-y border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="container-wide py-14 sm:py-16">
        <Reveal>
          <p className="text-center text-xs font-medium tracking-[0.16em] text-[var(--color-fg-subtle)] uppercase">
            {SOCIAL_PROOF.label}
          </p>
        </Reveal>

        <Stagger className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 sm:gap-x-14" stagger={0.06}>
          {SOCIAL_PROOF.logos.map((logo) => (
            <StaggerItem key={logo}>
              <span className="font-mono text-sm tracking-wide text-[var(--color-fg-muted)] sm:text-[0.9375rem]">
                {logo}
              </span>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
