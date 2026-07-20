"use client";

import { WHY_COMPARE } from "@/content/site-content";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";

export function WhySection() {
  return (
    <section id="why" className="section-pad border-y border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="container-wide">
        <Reveal>
          <p className="text-xs font-medium tracking-[0.16em] text-[var(--color-fg-subtle)] uppercase">
            Why Cloak
          </p>
          <h2 className="mt-4 max-w-2xl text-balance text-3xl font-semibold tracking-[-0.03em] sm:text-4xl lg:text-[2.75rem] lg:leading-[1.15]">
            Sync without surrendering the keys.
          </h2>
          <p className="mt-5 max-w-lg text-lg text-[var(--color-fg-muted)]">
            The gap between password managers and cloud secret stores — filled by local cryptography.
          </p>
        </Reveal>

        <Stagger className="mt-16 grid gap-12 lg:mt-24 lg:grid-cols-3 lg:gap-10" stagger={0.12}>
          {WHY_COMPARE.map((item) => (
            <StaggerItem key={item.title}>
              <div className="flex h-full flex-col">
                <h3 className="text-xl font-semibold tracking-tight">{item.title}</h3>
                <p className="mt-4 flex-1 text-[var(--color-fg-muted)] leading-relaxed">
                  <span className="text-[var(--color-fg-subtle)]">The gap — </span>
                  {item.weakness}
                </p>
                <div className="mt-8 border-t border-[var(--color-border)] pt-6">
                  <p className="text-xs font-medium tracking-[0.12em] text-[var(--color-fg-subtle)] uppercase">
                    With Cloak
                  </p>
                  <p className="mt-3 font-medium leading-relaxed text-[var(--color-fg)]">
                    {item.cloak}
                  </p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
