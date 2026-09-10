"use client";

import { useState } from "react";
import { SITE } from "@/constants/site";
import { DOWNLOAD_HERO } from "@/content/download-content";
import type { GitHubRelease } from "@/types/github";
import { DesktopDownloads, ServerDownload } from "./platform-downloads";
import { Requirements } from "./requirements";
import { SectionNav, type NavSection } from "./section-nav";
import { SetupGuide } from "./setup-guide";
import { VersionPicker, formatReleaseDate } from "./version-picker";

interface DownloadClientProps {
  releases: readonly GitHubRelease[];
  latestTag: string | null;
}

const SECTIONS: readonly NavSection[] = [
  { id: "downloads", label: "Downloads" },
  { id: "requirements", label: "What you need" },
  { id: "setup", label: "Setup guide" },
];

/**
 * Everything on the page reads from one selected release, so the installers,
 * the server bundle and every filename in the guide always agree.
 */
export function DownloadClient({ releases, latestTag }: DownloadClientProps) {
  const [tag, setTag] = useState(latestTag ?? releases[0].tagName);
  const release = releases.find((r) => r.tagName === tag) ?? releases[0];
  const isLatest = release.tagName === latestTag;

  return (
    <div className="container-wide lg:grid lg:grid-cols-[9.5rem_1fr] lg:gap-12">
      {/* Starts level with the first section so the three parts of the page are
          visible before any scrolling. */}
      <SectionNav sections={SECTIONS} />

      <div className="min-w-0">
        <section id="downloads" className="pt-16 pb-20 sm:pt-20">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="font-display text-4xl tracking-tight text-[var(--color-fg)] sm:text-5xl">
              {DOWNLOAD_HERO.title}
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-[var(--color-fg-muted)]">
              {DOWNLOAD_HERO.body}
            </p>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-3">
            <VersionPicker
              releases={releases}
              latestTag={latestTag}
              value={release.tagName}
              onChange={setTag}
            />
            <p className="text-sm text-[var(--color-fg-muted)]">
              Released {formatReleaseDate(release.publishedAt)}
              {" · "}
              <a
                href={release.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-[var(--color-fg)]"
              >
                Release notes
              </a>
            </p>
          </div>

          {!isLatest && latestTag && (
            <p className="mt-4 text-center text-sm text-[var(--color-fg-muted)]">
              You are looking at an older release.{" "}
              <button
                type="button"
                onClick={() => setTag(latestTag)}
                className="cursor-pointer font-medium text-[var(--color-fg)] underline underline-offset-4"
              >
                Get {latestTag} instead
              </button>
            </p>
          )}

          <div className="mx-auto mt-14 max-w-5xl">
            <DesktopDownloads release={release} />
          </div>

          <div className="mx-auto mt-14 max-w-5xl">
            <ServerDownload release={release} />
          </div>

          <p className="mx-auto mt-10 max-w-2xl text-center text-xs leading-relaxed text-[var(--color-fg-subtle)]">
            Installers are not code-signed yet, so Windows and macOS will ask you to confirm the
            publisher — the setup guide below shows how. Every asset is also listed, with its
            checksum, on the{" "}
            <a
              href={`${SITE.repo}/releases`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-[var(--color-fg)]"
            >
              releases page
            </a>
            .
          </p>
        </section>

        <Requirements />
        <SetupGuide
          release={release}
          latestTag={latestTag}
          onUseLatest={() => latestTag && setTag(latestTag)}
        />
      </div>
    </div>
  );
}
