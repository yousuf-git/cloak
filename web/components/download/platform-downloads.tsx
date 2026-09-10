import { Server, ShieldCheck } from "lucide-react";
import { AppleIcon, LinuxIcon, WindowsIcon } from "@/components/ui/platform-icons";
import { platformDownloads, serverBundle } from "@/lib/github";
import { formatBytes } from "@/lib/utils";
import type { GitHubRelease, GitHubReleaseAsset, PlatformId } from "@/types/github";

export function asset(release: GitHubRelease, platform: PlatformId, variantId: string) {
  return (
    platformDownloads(release, platform).find((d) => d.variant.id === variantId)?.asset ?? null
  );
}

/** The three desktop installers columns for one release. */
export function DesktopDownloads({ release }: { release: GitHubRelease }) {
  const exe = asset(release, "windows", "exe");
  const msi = asset(release, "windows", "msi");
  const appimage = asset(release, "linux", "appimage");
  const deb = asset(release, "linux", "deb");
  const rpm = asset(release, "linux", "rpm");
  const dmg = asset(release, "macos", "dmg");

  return (
    <div className="grid gap-14 sm:grid-cols-3 sm:gap-8">
      <PlatformColumn icon={<WindowsIcon className="h-14 w-14" />}>
        <BigButton href={exe?.browserDownloadUrl ?? msi?.browserDownloadUrl} label="Windows" sub="Windows 10, 11" />
        <VariantList
          rows={[
            { label: "Installer (.exe)", asset: exe, chip: "x64" },
            { label: "MSI package (.msi)", asset: msi, chip: "x64" },
          ]}
        />
      </PlatformColumn>

      <PlatformColumn icon={<LinuxIcon className="h-14 w-14" />}>
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

      <PlatformColumn icon={<AppleIcon className="h-14 w-14" />}>
        <BigButton href={dmg?.browserDownloadUrl} label="Mac" sub="Intel & Apple Silicon" />
        <VariantList rows={[{ label: ".dmg", asset: dmg, chip: "Universal" }]} />
      </PlatformColumn>
    </div>
  );
}

/**
 * The self-hosted backend. Shown for every release so the version picker never
 * silently drops it — older releases say why there is nothing to download.
 */
export function ServerDownload({ release }: { release: GitHubRelease }) {
  const { zip, checksum } = serverBundle(release);

  return (
    <div className="grid items-center gap-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:grid-cols-[auto_1fr_auto] sm:p-7">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]">
        <Server className="h-6 w-6 text-[var(--color-fg)]" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-[var(--color-fg)]">Cloak Server</h3>
        <p className="mt-1 max-w-xl text-[0.9375rem] leading-relaxed text-[var(--color-fg-muted)]">
          The backend every app connects to. Runs with Docker or Node.js on any machine you
          control — one for your whole team, or one just for you.
        </p>
        {zip && (
          <p className="mt-2 font-mono text-xs text-[var(--color-fg-subtle)]">
            {zip.name} · {formatBytes(zip.size)}
          </p>
        )}
      </div>
      {zip ? (
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <DownloadLink asset={zip} label="Download .zip" />
          {checksum && (
            <a
              href={checksum.browserDownloadUrl}
              className="inline-flex items-center justify-center gap-1.5 text-sm text-[var(--color-fg-muted)] underline-offset-4 hover:text-[var(--color-fg)] hover:underline"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              SHA-256 checksum
            </a>
          )}
        </div>
      ) : (
        <p className="max-w-[16rem] text-sm text-[var(--color-fg-subtle)] sm:text-right">
          {release.tagName} predates the self-hosted server bundle. Choose v0.2.0 or later.
        </p>
      )}
    </div>
  );
}

// -------------------------------------------------------------- primitives ---

function PlatformColumn({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-7">
      <div className="flex h-20 items-center text-[var(--color-fg)]">{icon}</div>
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
        className={`flex flex-col items-center rounded-xl border border-dashed border-[var(--color-border-strong)] px-6 py-3 text-[var(--color-fg-subtle)] ${narrow ? "" : "min-w-[180px]"}`}
      >
        <span className="font-semibold">{label}</span>
        <span className="text-xs">Not in this release</span>
      </div>
    );
  }
  return (
    <a
      href={href}
      className={`group flex flex-col items-center rounded-xl bg-[var(--color-fg)] px-6 py-3 text-[var(--color-bg)] transition-colors hover:bg-brand-600 dark:hover:bg-brand-400 ${narrow ? "" : "min-w-[180px]"}`}
    >
      <span className="inline-flex items-center gap-2 text-lg font-semibold">
        <DownArrow />
        {label}
      </span>
      <span className="text-xs opacity-80">{sub}</span>
    </a>
  );
}

function DownloadLink({ asset: file, label }: { asset: GitHubReleaseAsset; label: string }) {
  return (
    <a
      href={file.browserDownloadUrl}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--color-fg)] px-5 text-[0.9375rem] font-medium text-[var(--color-bg)] transition-colors hover:bg-brand-600 dark:hover:bg-brand-400"
    >
      <DownArrow />
      {label}
    </a>
  );
}

function VariantList({
  rows,
}: {
  rows: { label: string; asset: GitHubReleaseAsset | null; chip: string }[];
}) {
  // Each row is one click target — the chip is a visual hint, not a separate link.
  return (
    <div className="w-full max-w-[260px] divide-y divide-[var(--color-border)] overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
      {rows.map((row) =>
        row.asset ? (
          <a
            key={row.label}
            href={row.asset.browserDownloadUrl}
            title={`${row.asset.name} · ${formatBytes(row.asset.size)}`}
            className="flex items-center justify-between gap-4 px-3.5 py-2.5 transition-colors hover:bg-[var(--color-surface-2)]"
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

export function DownArrow() {
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
