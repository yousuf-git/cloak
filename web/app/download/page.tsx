import type { Metadata } from "next";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { DownloadClient } from "@/components/download/download-client";
import { SITE } from "@/constants/site";
import { getReleases, pickLatest } from "@/lib/github";

const TITLE = "Download Cloak - Windows, macOS, Linux, and the self-hosted server";
const DESCRIPTION =
  "Download Cloak for Windows, macOS, or Linux, plus the self-hosted server bundle. Free and MIT open source — with a full setup guide for running it solo or for your team.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/download" },
  openGraph: {
    url: "/download",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default async function DownloadPage() {
  const releases = await getReleases();
  const latest = pickLatest(releases);

  if (releases.length === 0) {
    return (
      <main className="container-wide pt-16 pb-24 sm:pt-20">
        <div className="mx-auto max-w-md text-center">
          <h1 className="font-display text-4xl tracking-tight text-[var(--color-fg)]">
            Download Cloak
          </h1>
          <p className="mt-4 text-[var(--color-fg-muted)]">
            No packaged release is available right now.
          </p>
          <div className="mt-6 flex justify-center">
            <MagneticButton href={SITE.sourceBuildUrl} external size="lg">
              Build from source
            </MagneticButton>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <DownloadClient releases={releases} latestTag={latest?.tagName ?? null} />
    </main>
  );
}
