"use client";

import { useRef, useState } from "react";
import { motion, useInView } from "motion/react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { Section } from "@/components/ui/section";
import { usePrefersReducedMotion } from "@/hooks/use-platform";
import { cn } from "@/lib/utils";

interface FAQItem {
  question: string;
  answer: string;
}

export function FAQSection({ items }: { items: readonly FAQItem[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.15, once: true });
  const reduced = usePrefersReducedMotion();

  return (
    <Section
      id="faq"
      label="FAQ"
      title="Questions"
      description="Common questions before you download."
      className="pb-20"
      icon={<HelpCircle className="h-4 w-4" />}
      accent
    >
      <div ref={ref} className="mx-auto max-w-3xl">
        {items.map((item, index) => {
          const isOpen = open === index;
          return (
            <motion.div
              key={item.question}
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: index * 0.06, duration: 0.4 }}
              className="mb-3"
            >
              <div
                className={cn(
                  "panel overflow-hidden transition-colors",
                  isOpen && "border-brand-500/25",
                )}
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : index)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-base font-medium hover:bg-[var(--color-surface)]"
                  aria-expanded={isOpen}
                >
                  <span className="flex items-center gap-3">
                    <span className="font-mono text-sm text-[var(--color-fg-subtle)]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {item.question}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 shrink-0 text-[var(--color-fg-muted)] transition-transform",
                      isOpen && "rotate-180 text-brand-600 dark:text-brand-400",
                    )}
                  />
                </button>
                {isOpen && (
                  <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)]/50 px-5 py-4">
                    <p className="text-base leading-relaxed text-[var(--color-fg-muted)]">{item.answer}</p>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </Section>
  );
}
