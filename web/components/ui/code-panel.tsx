"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CodePanelProps {
  code: string;
  title?: string;
  language?: string;
  className?: string;
  showCopy?: boolean;
}

export function CodePanel({
  code,
  title,
  language = "bash",
  className,
  showCopy = true,
}: CodePanelProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("panel overflow-hidden font-mono text-base", className)}>
      {(title || showCopy) && (
        <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2">
          <span className="text-sm text-[var(--color-fg-subtle)]">
            {title ?? language}
          </span>
          {showCopy && (
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1.5 text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              aria-label="Copy"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </button>
          )}
        </div>
      )}
      <pre className="overflow-x-auto p-4 leading-relaxed text-[var(--color-fg)]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

interface TerminalLine {
  type: "prompt" | "output";
  text: string;
}

interface TerminalPanelProps {
  lines: readonly TerminalLine[];
  title?: string;
  className?: string;
}

export function TerminalPanel({
  lines,
  title = "terminal",
  className,
}: TerminalPanelProps) {
  return (
    <div className={cn("panel overflow-hidden font-mono text-base", className)}>
      <div className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2 text-sm text-[var(--color-fg-subtle)]">
        {title}
      </div>
      <div className="space-y-1 p-4 leading-relaxed">
        {lines.map((line, i) => (
          <div
            key={`${line.text}-${i}`}
            className={line.type === "prompt" ? "text-[var(--color-fg)]" : "text-[var(--color-fg-muted)]"}
          >
            {line.text}
          </div>
        ))}
      </div>
    </div>
  );
}
