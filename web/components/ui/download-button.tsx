"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { PLATFORMS, SITE } from "@/constants/site";
import { usePlatform } from "@/hooks/use-platform";
import { getDownloadUrl, getPlatformLabel } from "@/lib/github";
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
  const primaryLabel = primary.isSourceBuild
    ? "Build from source"
    : `Download for ${getPlatformLabel(platform)}`;

  return (
    <div className={cn(className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative inline-flex">
          <MagneticButton
            href={primary.url}
            size="lg"
            external={!primary.isSourceBuild}
            className={cn(
              "rounded-r-none rounded-l-full",
              inverted && "bg-white text-[#111110] hover:bg-white/90",
            )}
          >
            {primaryLabel}
          </MagneticButton>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className={cn(
              "inline-flex h-12 items-center rounded-r-full border-l px-3 transition-colors",
              inverted
                ? "border-black/10 bg-white text-[#111110] hover:bg-white/90"
                : "border-white/15 bg-[var(--color-fg)] text-[var(--color-bg)] hover:bg-brand-600",
            )}
            aria-label="Other platforms"
            aria-expanded={open}
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              <div className="absolute top-full left-0 z-50 mt-2 min-w-[240px] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-fg)] shadow-sm">
                {PLATFORMS.map((item) => {
                  const asset = release?.assets.find((a) => item.assetPattern.test(a.name));
                  const dl = getDownloadUrl(release, item.id);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelected(item.id);
                        setOpen(false);
                        if (!dl.isSourceBuild) {
                          window.open(dl.url, "_blank", "noopener,noreferrer");
                        } else {
                          window.location.href = dl.url;
                        }
                      }}
                      className="flex w-full flex-col px-4 py-3 text-left text-[0.9375rem] first:rounded-t-xl last:rounded-b-none hover:bg-[var(--color-surface-2)]"
                    >
                      <span className="font-medium">{item.label}</span>
                      <span className="text-xs text-[var(--color-fg-muted)]">
                        {asset ? `${asset.name} · ${formatBytes(asset.size)}` : "Build from source"}
                      </span>
                    </button>
                  );
                })}
                <a
                  href={`${SITE.repo}/releases`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-b-xl border-t border-[var(--color-border)] px-4 py-2.5 text-sm text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)]"
                >
                  All releases on GitHub
                </a>
              </div>
            </>
          )}
        </div>

        {PLATFORMS.filter((p) => p.id !== platform).map((item) => {
          const dl = getDownloadUrl(release, item.id);
          return (
            <MagneticButton
              key={item.id}
              href={dl.url}
              variant="secondary"
              size="md"
              external={!dl.isSourceBuild}
              className={cn(
                inverted && "border-white/25 !text-[#fafaf9] hover:border-white hover:bg-white/5",
              )}
            >
              {item.label}
            </MagneticButton>
          );
        })}
      </div>

      <p
        className={cn(
          "mt-5 max-w-md text-sm",
          inverted ? "text-[#fafaf9]/55" : "text-[var(--color-fg-muted)]",
        )}
      >
        {release ? (
          <>
            Latest · <span className="font-mono">{release.tagName}</span>
            {" · "}
          </>
        ) : null}
        Open source under {SITE.license}.
      </p>
    </div>
  );
}
