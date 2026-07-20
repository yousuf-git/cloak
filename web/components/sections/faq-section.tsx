"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus } from "lucide-react";
import { FAQ_ITEMS } from "@/content/site-content";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";

interface FAQSectionProps {
  items?: typeof FAQ_ITEMS;
}

export function FAQSection({ items = FAQ_ITEMS }: FAQSectionProps) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="section-pad border-t border-[var(--color-border)]">
      <div className="container-wide">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
          <Reveal>
            <p className="text-xs font-medium tracking-[0.16em] text-[var(--color-fg-subtle)] uppercase">
              FAQ
            </p>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              Questions, answered plainly.
            </h2>
            <p className="mt-5 max-w-sm text-[var(--color-fg-muted)]">
              Security model, platforms, sandbox, and license — without the marketing fog.
            </p>
          </Reveal>

          <div className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
            {items.map((item, i) => {
              const isOpen = open === i;
              return (
                <div key={item.question}>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-start justify-between gap-6 py-6 text-left transition-colors hover:text-[var(--color-fg)]"
                    aria-expanded={isOpen}
                  >
                    <span className="text-lg font-medium tracking-tight">{item.question}</span>
                    <Plus
                      className={cn(
                        "mt-1 h-5 w-5 shrink-0 text-[var(--color-fg-subtle)] transition-transform duration-300",
                        isOpen && "rotate-45",
                      )}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <p className="max-w-xl pb-6 leading-relaxed text-[var(--color-fg-muted)]">
                          {item.answer}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
