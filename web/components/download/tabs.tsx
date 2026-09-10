"use client";

import { useId, useRef } from "react";
import { cn } from "@/lib/utils";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
}

interface TabsProps<T extends string> {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  children: React.ReactNode;
}

/** Underlined tabs with arrow-key navigation, per the WAI-ARIA tabs pattern. */
export function Tabs<T extends string>({ items, value, onChange, label, children }: TabsProps<T>) {
  const baseId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (from: number, step: number) => {
    const next = (from + step + items.length) % items.length;
    onChange(items[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label={label}
        className="flex gap-1 overflow-x-auto border-b border-[var(--color-border)]"
      >
        {items.map((item, index) => {
          const selected = item.id === value;
          return (
            <button
              key={item.id}
              ref={(el) => {
                refs.current[index] = el;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(item.id)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight") move(index, 1);
                if (event.key === "ArrowLeft") move(index, -1);
              }}
              className={cn(
                "-mb-px inline-flex cursor-pointer items-center gap-2 border-b-2 px-3.5 py-2.5 text-[0.9375rem] whitespace-nowrap transition-colors",
                selected
                  ? "border-[var(--color-fg)] text-[var(--color-fg)]"
                  : "border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]",
              )}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={`${baseId}-tab-${value}`}
        className="pt-6"
      >
        {children}
      </div>
    </div>
  );
}
