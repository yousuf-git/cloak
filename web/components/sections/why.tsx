"use client";

import Image from "next/image";
import { Check, Minus, X } from "lucide-react";
import { WHY_MATRIX, type WhyMark } from "@/content/site-content";
import { Reveal } from "@/components/motion/reveal";

export function WhySection() {
  return (
    <section id="why" className="section-pad border-y border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="container-wide">
        <Reveal>
          <p className="text-xs font-medium tracking-[0.16em] text-[var(--color-fg-subtle)] uppercase">
            Why Cloak
          </p>
          <h2 className="mt-4 max-w-2xl text-balance text-3xl font-semibold tracking-[-0.03em] sm:text-4xl lg:text-[2.75rem] lg:leading-[1.15]">
            Alternatives cover a slice. Cloak covers the workflow.
          </h2>
          <p className="mt-5 max-w-lg text-lg text-[var(--color-fg-muted)]">
            Password managers stop at logins, secret stores stop at the server, and
            notes stop at nothing. One vault closes the gaps.
          </p>
        </Reveal>

        <Reveal className="mt-16 lg:mt-20">
          <div className="overflow-x-auto">
            <div className="min-w-[760px] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)]">
              {/* Header */}
              <div className="grid grid-cols-[minmax(230px,1.5fr)_repeat(4,1fr)] border-b border-[var(--color-border)]">
                <div className="px-5 py-4" />
                {WHY_MATRIX.columns.map((col) => (
                  <div
                    key={col}
                    className="flex items-end justify-center px-3 py-4 text-center text-sm font-medium text-[var(--color-fg-muted)]"
                  >
                    {col}
                  </div>
                ))}
                <div className="flex items-center justify-center gap-2 border-l border-[var(--color-border)] bg-brand-600/5 px-3 py-4">
                  <Image
                    src="/logo.png"
                    alt=""
                    width={40}
                    height={40}
                    className="h-5 w-5 rounded-full"
                  />
                  <span className="font-display text-lg tracking-tight text-[var(--color-fg)]">
                    Cloak
                  </span>
                </div>
              </div>

              {/* Rows */}
              <div className="divide-y divide-[var(--color-border)]">
                {WHY_MATRIX.rows.map((row) => (
                  <div
                    key={row.feature}
                    className="grid grid-cols-[minmax(230px,1.5fr)_repeat(4,1fr)] transition-colors hover:bg-[var(--color-surface)]"
                  >
                    <div className="px-5 py-3.5 text-sm font-medium text-[var(--color-fg)]">
                      {row.feature}
                    </div>
                    {row.marks.map((mark, i) => (
                      <div key={i} className="flex items-center justify-center px-3 py-3.5">
                        <Mark value={mark} />
                      </div>
                    ))}
                    <div className="flex items-center justify-center border-l border-[var(--color-border)] bg-brand-600/5 px-3 py-3.5">
                      <Mark value="yes" cloak />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[var(--color-fg-subtle)]">
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" /> Included
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Minus className="h-3.5 w-3.5" /> Partial — plugins, add-ons, or manual workarounds
            </span>
            <span className="inline-flex items-center gap-1.5">
              <X className="h-3.5 w-3.5" /> Not covered
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Mark({ value, cloak = false }: { value: WhyMark; cloak?: boolean }) {
  if (value === "yes") {
    return (
      <span
        className={
          cloak
            ? "flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white"
            : "text-[var(--color-fg-muted)]"
        }
        aria-label="Included"
      >
        <Check className={cloak ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={cloak ? 3 : 2} />
      </span>
    );
  }
  if (value === "partial") {
    return (
      <span className="text-[var(--color-fg-subtle)]" aria-label="Partial support">
        <Minus className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span className="text-[var(--color-fg-subtle)] opacity-50" aria-label="Not covered">
      <X className="h-4 w-4" />
    </span>
  );
}
