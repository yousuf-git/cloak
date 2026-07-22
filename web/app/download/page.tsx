import type { Metadata } from "next";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { WindowsIcon, LinuxIcon, AppleIcon } from "@/components/ui/platform-icons";
import { SITE } from "@/constants/site";
import { getGitHubData, platformDownloads } from "@/lib/github";
import { formatBytes } from "@/lib/utils";
import type { GitHubRelease, PlatformId } from "@/types/github";

const TITLE = "Download Cloak - Windows, macOS, Linux";
const DESCRIPTION =
  "Download Cloak for Windows, macOS, or Linux. Free and MIT open source — a zero-knowledge secrets manager with installers for .exe, .msi, universal .dmg, AppImage, .deb, and .rpm.";

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
  const github = await getGitHubData();
  const release = github.latestRelease;

  return (
    <>
      <Navbar repo={github.repo} />
      <main className="container-wide pt-16 pb-24 sm:pt-20">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="font-display text-4xl tracking-tight text-[var(--color-fg)] sm:text-5xl">
            Download Cloak
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-[var(--color-fg-muted)]">
            Free and MIT open source. Zero-knowledge by design — every secret is
            encrypted on your machine before it syncs.
          </p>
        </div>

        {release ? (
          <>
            <div className="mx-auto mt-16 grid max-w-5xl gap-14 sm:grid-cols-3 sm:gap-8">
              <WindowsColumn release={release} />
              <LinuxColumn release={release} />
              <MacColumn release={release} />
            </div>

            <p className="mt-16 text-center text-sm text-[var(--color-fg-muted)]">
              Latest · <span className="font-mono">{release.tagName}</span>
              {" · "}
              <a
                href={release.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-[var(--color-fg)]"
              >
                Release notes
              </a>
              {" · "}
              <a
                href={`${SITE.repo}/releases`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-[var(--color-fg)]"
              >
                All releases
              </a>
            </p>
            <p className="mt-3 text-center text-xs text-[var(--color-fg-subtle)]">
              Installers are not yet code-signed — your OS may ask you to confirm
              the publisher. Verify checksums from the GitHub release page.
            </p>
          </>
        ) : (
          <div className="mx-auto mt-16 max-w-md text-center">
            <p className="text-[var(--color-fg-muted)]">
              No packaged release is available right now.
            </p>
            <div className="mt-6 flex justify-center">
              <MagneticButton href={`${SITE.repo}#getting-started`} external size="lg">
                Build from source
              </MagneticButton>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}

// ---------------------------------------------------------------- columns ---

function asset(release: GitHubRelease, platform: PlatformId, variantId: string) {
  return (
    platformDownloads(release, platform).find((d) => d.variant.id === variantId)
      ?.asset ?? null
  );
}

function WindowsColumn({ release }: { release: GitHubRelease }) {
  const exe = asset(release, "windows", "exe");
  const msi = asset(release, "windows", "msi");

  return (
    <PlatformColumn icon={<WindowsIcon className="h-16 w-16" />}>
      <BigButton
        href={exe?.browserDownloadUrl ?? msi?.browserDownloadUrl}
        label="Windows"
        sub="Windows 10, 11"
      />
      <VariantList
        rows={[
          { label: "Installer (.exe)", asset: exe, chip: "x64" },
          { label: "MSI package (.msi)", asset: msi, chip: "x64" },
        ]}
      />
    </PlatformColumn>
  );
}

function LinuxColumn({ release }: { release: GitHubRelease }) {
  const appimage = asset(release, "linux", "appimage");
  const deb = asset(release, "linux", "deb");
  const rpm = asset(release, "linux", "rpm");

  return (
    <PlatformColumn icon={<LinuxIcon className="h-16 w-16" />}>
      <div className="flex justify-center gap-2">
        <BigButton href={deb?.browserDownloadUrl} label=".deb" sub="Debian, Ubuntu" narrow />
        <BigButton href={rpm?.browserDownloadUrl} label=".rpm" sub="Fedora, SUSE" narrow />
      </div>
      <VariantList
        rows={[
          { label: "AppImage — portable", asset: appimage, chip: "x64" },
          { label: ".deb", asset: deb, chip: "x64" },
          { label: ".rpm", asset: rpm, chip: "x64" },
        ]}
      />
    </PlatformColumn>
  );
}

function MacColumn({ release }: { release: GitHubRelease }) {
  const dmg = asset(release, "macos", "dmg");

  return (
    <PlatformColumn icon={<AppleIcon className="h-16 w-16" />}>
      <BigButton
        href={dmg?.browserDownloadUrl}
        label="Mac"
        sub="Intel & Apple Silicon"
      />
      <VariantList rows={[{ label: ".dmg", asset: dmg, chip: "Universal" }]} />
    </PlatformColumn>
  );
}

// -------------------------------------------------------------- primitives ---

function PlatformColumn({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex h-24 items-center text-[var(--color-fg)]">{icon}</div>
      {children}
    </div>
  );
}

function BigButton({
  href,
  label,
  sub,
  narrow = false,
}: {
  href?: string;
  label: string;
  sub: string;
  narrow?: boolean;
}) {
  if (!href) {
    return (
      <div
        className={`flex flex-col items-center rounded-xl border border-dashed border-[var(--color-border)] px-6 py-3 text-[var(--color-fg-subtle)] ${narrow ? "" : "min-w-[180px]"}`}
      >
        <span className="font-semibold">{label}</span>
        <span className="text-xs">Not available</span>
      </div>
    );
  }
  return (
    <a
      href={href}
      className={`group flex flex-col items-center rounded-xl bg-[var(--color-fg)] px-6 py-3 text-[var(--color-bg)] transition-colors hover:bg-brand-600 ${narrow ? "" : "min-w-[180px]"}`}
    >
      <span className="inline-flex items-center gap-2 text-lg font-semibold">
        <DownArrow />
        {label}
      </span>
      <span className="text-xs opacity-80">{sub}</span>
    </a>
  );
}

function VariantList({
  rows,
}: {
  rows: {
    label: string;
    asset: { browserDownloadUrl: string; name: string; size: number } | null;
    chip: string;
  }[];
}) {
  // Each row is one click target — the chip is a visual hint, not a separate link.
  return (
    <div className="w-full max-w-[260px] divide-y divide-[var(--color-border)] overflow-hidden rounded-lg border border-[var(--color-border)]">
      {rows.map((row) =>
        row.asset ? (
          <a
            key={row.label}
            href={row.asset.browserDownloadUrl}
            title={`${row.asset.name} · ${formatBytes(row.asset.size)}`}
            className="flex items-center justify-between gap-4 px-3.5 py-2.5 transition-colors hover:bg-[var(--color-surface)]"
          >
            <span className="text-sm font-medium text-[var(--color-fg)]">{row.label}</span>
            <span className="rounded-md border border-[var(--color-border)] px-2 py-0.5 font-mono text-xs text-[var(--color-fg-muted)]">
              {row.chip}
            </span>
          </a>
        ) : (
          <div key={row.label} className="flex items-center justify-between gap-4 px-3.5 py-2.5">
            <span className="text-sm font-medium text-[var(--color-fg-subtle)]">{row.label}</span>
            <span className="font-mono text-xs text-[var(--color-fg-subtle)]">—</span>
          </div>
        ),
      )}
    </div>
  );
}

function DownArrow() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden>
      <path
        d="M8 2v9m0 0L4.5 7.5M8 11l3.5-3.5M3 13.5h10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
