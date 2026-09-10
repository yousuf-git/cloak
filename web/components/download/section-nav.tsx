"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface NavSection {
  id: string;
  label: string;
}

/**
 * A rail of the page's three parts, sticky beside the content.
 *
 * The page is long enough that the version picker and the setup guide are far
 * apart; this keeps both one click away without a second trip through the
 * header.
 */
export function SectionNav({ sections }: { sections: readonly NavSection[] }) {
  const active = useActiveSection(sections);

  return (
    <nav aria-label="On this page" className="hidden pt-16 sm:pt-20 lg:block">
      <ul className="sticky top-28 space-y-1 border-l border-[var(--color-border)]">
        {sections.map((section) => {
          const current = section.id === active;
          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                aria-current={current ? "true" : undefined}
                className={cn(
                  "-ml-px block border-l py-1.5 pl-4 text-sm transition-colors",
                  current
                    ? "border-[var(--color-fg)] text-[var(--color-fg)]"
                    : "border-transparent text-[var(--color-fg-subtle)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]",
                )}
              >
                {section.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * The section whose heading last passed under the header. A plain
 * IntersectionObserver would light up whichever section merely intersects,
 * which for a tall page is often two at once.
 */
function useActiveSection(sections: readonly NavSection[]): string | null {
  const [active, setActive] = useState<string | null>(sections[0]?.id ?? null);

  useEffect(() => {
    const ids = sections.map((section) => section.id);

    const update = () => {
      // Just below where an anchor click parks a section, which the page's
      // scroll-padding-top puts clear of the sticky header.
      const line = 96;
      let current = ids[0] ?? null;
      for (const id of ids) {
        const top = document.getElementById(id)?.getBoundingClientRect().top;
        if (top !== undefined && top <= line) current = id;
      }
      // The last section can be too short to reach the line; at the bottom of
      // the page it is what the reader is looking at regardless.
      if (window.scrollY + window.innerHeight >= document.body.scrollHeight - 4) {
        current = ids[ids.length - 1] ?? current;
      }
      setActive(current);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [sections]);

  return active;
}
