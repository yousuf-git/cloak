"use client";

import { STATS } from "@/content/site-content";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { AnimatedCounter } from "@/components/motion/counter";

export function StatsSection() {
  return (
    <section className="border-y border-[var(--color-border)] bg-[var(--color-surface-2)]/40">
      <div className="container-wide section-pad !py-20 lg:!py-28">
        <Reveal>
          <p className="text-center text-xs font-medium tracking-[0.16em] text-[var(--color-fg-subtle)] uppercase">
            By design
          </p>
        </Reveal>

        <Stagger
          className="mt-14 grid grid-cols-2 gap-10 lg:mt-16 lg:grid-cols-4 lg:gap-8"
          stagger={0.08}
        >
          {STATS.map((stat) => (
            <StaggerItem key={stat.label} className="text-center lg:text-left">
              <p className="font-display text-5xl tracking-tight sm:text-6xl lg:text-7xl">
                <AnimatedCounter
                  value={stat.value}
                  display={stat.display}
                  suffix={stat.suffix}
                />
              </p>
              <p className="mt-3 text-sm leading-relaxed text-[var(--color-fg-muted)] sm:text-base">
                {stat.label}
              </p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
