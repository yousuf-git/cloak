"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GitHubRelease } from "@/types/github";

interface VersionPickerProps {
  releases: readonly GitHubRelease[];
  latestTag: string | null;
  value: string;
  onChange: (tag: string) => void;
}

/** Fixed locale and zone so the server render and the browser agree. */
export function formatReleaseDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** A listbox of releases — keyboard reachable, closes on Escape or outside click. */
export function VersionPicker({ releases, latestTag, value, onChange }: VersionPickerProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    listRef.current?.focus();
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const openList = () => {
    setActive(Math.max(0, releases.findIndex((r) => r.tagName === value)));
    setOpen(true);
  };

  const choose = (index: number) => {
    const release = releases[index];
    if (release) onChange(release.tagName);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onListKey = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(releases.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(releases.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(active);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Version ${value}. Change version`}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openList();
          }
        }}
        className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface)] pr-3 pl-4 transition-colors hover:border-[var(--color-fg)]"
      >
        <span className="font-mono text-sm text-[var(--color-fg)]">{value}</span>
        {value === latestTag && <Tag>Latest</Tag>}
        <ChevronDown
          className={cn("h-4 w-4 text-[var(--color-fg-muted)] transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label="Releases"
          aria-activedescendant={`${listId}-${active}`}
          onKeyDown={onListKey}
          className="absolute top-full left-1/2 z-40 mt-2 max-h-80 w-72 -translate-x-1/2 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-[0_12px_40px_-12px_rgb(0_0_0/0.25)] outline-none"
        >
          {releases.map((release, index) => {
            const selected = release.tagName === value;
            return (
              <li
                key={release.tagName}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={selected}
                onPointerEnter={() => setActive(index)}
                onClick={() => choose(index)}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5",
                  index === active && "bg-[var(--color-surface-2)]",
                )}
              >
                <span className="flex flex-col">
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-sm text-[var(--color-fg)]">{release.tagName}</span>
                    {release.tagName === latestTag && <Tag>Latest</Tag>}
                    {release.prerelease && <Tag muted>Pre-release</Tag>}
                  </span>
                  <span className="text-xs text-[var(--color-fg-subtle)]">
                    {formatReleaseDate(release.publishedAt)}
                  </span>
                </span>
                {selected && <Check className="h-4 w-4 shrink-0 text-[var(--color-fg)]" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Tag({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[0.6875rem] font-medium tracking-wide",
        muted
          ? "border border-[var(--color-border)] text-[var(--color-fg-muted)]"
          : "bg-brand-500/10 text-brand-500 dark:bg-brand-400/15 dark:text-[#8fc7ab]",
      )}
    >
      {children}
    </span>
  );
}
