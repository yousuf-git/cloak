"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { PLATFORMS, SITE } from "@/constants/site";
import { usePlatform } from "@/hooks/use-platform";
import { getDownloadUrl, getPlatformLabel } from "@/lib/github";
import { formatBytes } from "@/lib/utils";
import type { GitHubRelease, PlatformId } from "@/types/github";
import { Button } from "@/components/ui/button";
import { VaultLockVisual } from "@/components/ui/vault-lock-visual";
import { cn } from "@/lib/utils";

interface DownloadRowProps {
  release: GitHubRelease | null;
  className?: string;
}

export function DownloadRow({ release, className }: DownloadRowProps) {
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
      <div className="flex flex-wrap items-center justify-center gap-2">
        <div className="relative inline-flex">
          <Button
            href={primary.url}
            size="lg"
            external={!primary.isSourceBuild}
            className="rounded-r-none"
          >
            {primaryLabel}
          </Button>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="inline-flex h-12 items-center border border-l-0 border-brand-700 bg-brand-600 px-3 text-white hover:bg-brand-700 dark:border-brand-700 dark:bg-brand-600"
            aria-label="Other platforms"
            aria-expanded={open}
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              <div className="absolute top-full left-0 z-50 mt-1 min-w-[220px] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-lg">
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
                      className="flex w-full flex-col px-4 py-3 text-left text-base hover:bg-[var(--color-surface)]"
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
                  className="block border-t border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-fg-muted)] hover:bg-[var(--color-surface)]"
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
            <Button
              key={item.id}
              href={dl.url}
              variant="secondary"
              size="md"
              external={!dl.isSourceBuild}
            >
              {item.label}
            </Button>
          );
        })}
      </div>

      <p className="mt-4 text-center text-base text-[var(--color-fg-muted)]">
        {release ? (
          <>
            Latest release: <span className="font-mono">{release.tagName}</span>
            {" · "}
          </>
        ) : null}
        Open source under {SITE.license}. By using Cloak, review the{" "}
        <a href={`${SITE.repo}/blob/main/LICENSE`} className="link-subtle">
          license
        </a>{" "}
        and security model.
      </p>
    </div>
  );
}

interface DownloadSectionProps {
  release: GitHubRelease | null;
}

export function DownloadSection({ release }: DownloadSectionProps) {
  return (
    <div className="panel overflow-hidden">
      <div className="grid lg:grid-cols-[1fr_280px] xl:grid-cols-[1fr_320px]">
        <div className="p-8 sm:p-10">
          <h3 className="text-2xl font-semibold tracking-tight">
            {release ? `Get Cloak ${release.tagName}` : "Build Cloak from source"}
          </h3>
          <p className="mt-3 max-w-xl text-lg text-[var(--color-fg-muted)]">
            Native desktop app for Windows, macOS, and Linux. Pre-built bundles appear here when
            published to GitHub Releases; otherwise build with Tauri on your platform.
          </p>
          <div className="mt-6">
            <DownloadRow release={release} />
          </div>
        </div>

        <div className="relative hidden border-l border-[var(--color-border)] bg-[var(--color-surface-2)]/50 lg:block">
          <VaultLockVisual className="h-full min-h-[320px] p-8" />
        </div>
      </div>

      {/* Mobile: compact visual below content */}
      <div className="border-t border-[var(--color-border)] bg-[var(--color-surface-2)]/50 lg:hidden">
        <VaultLockVisual className="min-h-[200px] py-8" />
      </div>
    </div>
  );
}
