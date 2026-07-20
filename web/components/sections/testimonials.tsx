"use client";

import { TESTIMONIALS } from "@/content/site-content";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";

export function TestimonialsSection() {
  return (
    <section id="voices" className="section-pad">
      <div className="container-wide">
        <Reveal>
          <p className="text-xs font-medium tracking-[0.16em] text-[var(--color-fg-subtle)] uppercase">
            Voices
          </p>
          <h2 className="mt-4 max-w-xl font-display text-4xl tracking-tight sm:text-5xl">
            What developers ask for.
          </h2>
        </Reveal>

        <Stagger className="mt-16 space-y-0 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)] lg:mt-20" stagger={0.1}>
          {TESTIMONIALS.map((item) => (
            <StaggerItem key={item.name}>
              <blockquote className="grid gap-8 py-12 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-16 lg:py-16">
                <p className="max-w-3xl text-2xl leading-snug tracking-[-0.02em] text-[var(--color-fg)] sm:text-3xl lg:text-[2rem] lg:leading-[1.35]">
                  “{item.quote}”
                </p>
                <footer className="shrink-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-border)] font-mono text-sm text-[var(--color-fg-muted)]">
                    {item.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <cite className="mt-4 block not-italic">
                    <span className="font-medium text-[var(--color-fg)]">{item.name}</span>
                    <span className="mt-1 block text-sm text-[var(--color-fg-subtle)]">{item.role}</span>
                  </cite>
                </footer>
              </blockquote>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
