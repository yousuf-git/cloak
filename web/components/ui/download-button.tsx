"use client";

import { useState } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import { usePlatform } from "@/hooks/use-platform";
import { getDownloadUrl, getPlatformLabel, platformDownloads } from "@/lib/github";
import { formatBytes } from "@/lib/utils";
import type { GitHubRelease, PlatformId } from "@/types/github";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { cn } from "@/lib/utils";

interface DownloadRowProps {
  release: GitHubRelease | null;
  className?: string;
  inverted?: boolean;
}

export function DownloadRow({ release, className, inverted = false }: DownloadRowProps) {
  const detected = usePlatform();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PlatformId>("unknown");

  const platform = selected !== "unknown" ? selected : detected;
  const primary = getDownloadUrl(release, platform);
  const downloads = platformDownloads(release, platform);
  // Only offer a dropdown when the visitor's OS actually has alternatives
  // (macOS ships a single universal dmg — no arrow there).
  const hasDropdown = downloads.length > 1;
  const primaryLabel =
    primary.kind === "source"
      ? "Build from source"
      : primary.kind === "picker"
        ? "Download Cloak"
        : `Download for ${getPlatformLabel(platform)}`;

  return (
    <div className={cn(className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative inline-flex">
          <MagneticButton
            href={primary.url}
            size="lg"
            external={primary.kind === "asset"}
            className={cn(
              hasDropdown ? "rounded-r-none rounded-l-full" : "rounded-full",
              inverted && "bg-white text-[#111110] hover:bg-white/90",
            )}
          >
            {primaryLabel}
          </MagneticButton>
          {hasDropdown && (
            <button
              type="button"
              onClick={() => setOpen(!open)}
              className={cn(
                "inline-flex h-12 cursor-pointer items-center rounded-r-full border-l px-3 transition-colors",
                inverted
                  ? "border-black/10 bg-white text-[#111110] hover:bg-white/90"
                  : "border-white/15 bg-[var(--color-fg)] text-[var(--color-bg)] hover:bg-brand-600",
              )}
              aria-label={`Other installers for ${getPlatformLabel(platform)}`}
              aria-expanded={open}
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
            </button>
          )}

          {open && hasDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              <div className="absolute top-full left-0 z-50 mt-2 min-w-[280px] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-fg)] shadow-sm">
                {downloads.map(({ variant, asset }) => (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      window.open(asset.browserDownloadUrl, "_blank", "noopener,noreferrer");
                    }}
                    className="flex w-full cursor-pointer flex-col px-4 py-2.5 text-left first:rounded-t-xl last:rounded-b-xl hover:bg-[var(--color-surface-2)]"
                  >
                    <span className="text-[0.9375rem] font-medium">{variant.label}</span>
                    <span className="text-xs text-[var(--color-fg-muted)]">
                      {asset.name} · {formatBytes(asset.size)}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <MagneticButton
          href="/download"
          variant="secondary"
          size="md"
          className={cn(
            inverted && "border-white/25 !text-[#fafaf9] hover:border-white hover:bg-white/5",
          )}
        >
          Other platforms
          <ArrowRight className="h-4 w-4" />
        </MagneticButton>
      </div>
    </div>
  );
}
