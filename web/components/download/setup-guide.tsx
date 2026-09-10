"use client";

import { useState } from "react";
import { AlertTriangle, Check, KeyRound, User, Users } from "lucide-react";
import { CodePanel } from "@/components/ui/code-panel";
import { AppleIcon, LinuxIcon, WindowsIcon } from "@/components/ui/platform-icons";
import { usePlatform } from "@/hooks/use-platform";
import { serverBundle } from "@/lib/github";
import { cn } from "@/lib/utils";
import {
  CHECK_POINTS,
  CLAIM_STEPS,
  ENV_VARS,
  GUIDE_STEPS,
  INSTALL_NOTES,
  INVITE_POINTS,
  MODES,
  SETUP_SH_NOTE,
  START_COMMANDS,
  TLS_COMMAND,
  TLS_NOTE,
  linuxCommands,
  unpackCommand,
  type SetupMode,
} from "@/content/download-content";
import type { GitHubRelease } from "@/types/github";
import { asset } from "./platform-downloads";
import { Tabs } from "./tabs";

type Os = "windows" | "macos" | "linux";
type Runner = keyof typeof START_COMMANDS;

interface SetupGuideProps {
  release: GitHubRelease;
  latestTag: string | null;
  onUseLatest: () => void;
}

export function SetupGuide({ release, latestTag, onUseLatest }: SetupGuideProps) {
  // Teams first, matching the rest of the site; solo is one click away.
  const [mode, setMode] = useState<SetupMode>("team");
  const detected = usePlatform();
  const [picked, setPicked] = useState<Os | null>(null);
  const os: Os = picked ?? (detected === "unknown" ? "windows" : detected);
  const [runner, setRunner] = useState<Runner>("docker");

  const { zip, checksum } = serverBundle(release);
  const steps = GUIDE_STEPS.filter((step) => step.modes.includes(mode));

  const body: Record<string, React.ReactNode> = {
    install: <InstallStep release={release} os={os} onOs={setPicked} />,
    server: (
      <ServerStep
        mode={mode}
        zipName={zip?.name ?? "cloak-server-vX.Y.Z.zip"}
        checksumName={checksum?.name ?? null}
        runner={runner}
        onRunner={setRunner}
      />
    ),
    tls: (
      <div className="space-y-5">
        <Prose>
          For a server your team reaches over the internet, the bundle ships a Caddy overlay.
          Point DNS at the machine, then:
        </Prose>
        <Command code={TLS_COMMAND} title="docker compose + Caddy" />
        <Callout tone="warn">{TLS_NOTE}</Callout>
      </div>
    ),
    check: (
      <div className="grid gap-3 sm:grid-cols-3">
        {CHECK_POINTS.map((point) => (
          <MiniCard key={point.title} title={point.title}>
            {point.body}
          </MiniCard>
        ))}
      </div>
    ),
    claim: <NumberedList items={CLAIM_STEPS[mode]} />,
    invite: (
      <div className="grid gap-3 sm:grid-cols-2">
        {INVITE_POINTS.map((point, index) => (
          <MiniCard key={point.title} title={point.title} index={index + 1}>
            {point.body}
          </MiniCard>
        ))}
      </div>
    ),
  };

  return (
    <section
      id="setup"
      className="border-t border-[var(--color-border)] py-16 sm:py-20"
    >
      <header className="max-w-2xl">
        <p className="text-xs font-medium tracking-[0.14em] text-[var(--color-fg-subtle)] uppercase">
          Setup guide
        </p>
        <h2 className="mt-3 font-display text-3xl tracking-tight text-[var(--color-fg)] sm:text-4xl">
          From download to unlocked
        </h2>
        <p className="mt-3 text-[1.0625rem] leading-relaxed text-[var(--color-fg-muted)]">
          The same server and the same app either way. Pick who it is for and the steps adjust.
        </p>
      </header>

      <ModeSwitch mode={mode} onChange={setMode} />

      {!zip && (
        <div className="mt-10">
          <Callout tone="warn">
            {release.tagName} was released before the self-hosted server existed, so this guide
            does not apply to it.{" "}
            {latestTag && (
              <button
                type="button"
                onClick={onUseLatest}
                className="cursor-pointer font-medium text-[var(--color-fg)] underline underline-offset-4"
              >
                Switch to {latestTag}
              </button>
            )}
          </Callout>
        </div>
      )}

      <ol className="mt-12">
        {steps.map((step, index) => (
          <Step
            key={step.id}
            number={index + 1}
            title={step.title}
            last={index === steps.length - 1}
          >
            {body[step.id]}
          </Step>
        ))}
      </ol>
    </section>
  );
}

// ------------------------------------------------------------------ steps ---

function InstallStep({
  release,
  os,
  onOs,
}: {
  release: GitHubRelease;
  os: Os;
  onOs: (os: Os) => void;
}) {
  const files = {
    appimage: asset(release, "linux", "appimage")?.name,
    deb: asset(release, "linux", "deb")?.name,
    rpm: asset(release, "linux", "rpm")?.name,
  };
  const linux = linuxCommands(files);

  return (
    <Tabs
      label="Operating system"
      value={os}
      onChange={onOs}
      items={[
        { id: "windows", label: "Windows", icon: <WindowsIcon className="h-4 w-4" /> },
        { id: "macos", label: "macOS", icon: <AppleIcon className="h-4 w-4" /> },
        { id: "linux", label: "Linux", icon: <LinuxIcon className="h-4 w-4" /> },
      ]}
    >
      {os === "windows" && <BulletList items={INSTALL_NOTES.windows.steps} />}
      {os === "macos" && (
        <div className="space-y-5">
          <BulletList items={INSTALL_NOTES.macos.steps} />
          <Command code={INSTALL_NOTES.macos.command} title="Terminal" />
        </div>
      )}
      {os === "linux" && (
        <div className="space-y-5">
          <BulletList items={INSTALL_NOTES.linux.steps} />
          <Command code={linux.appimage} title="AppImage" />
          {/* Stacked, not side by side: the release filenames are long enough
              that two columns clip them. */}
          <Command code={linux.deb} title="Debian / Ubuntu" />
          <Command code={linux.rpm} title="Fedora / openSUSE" />
        </div>
      )}
    </Tabs>
  );
}

function ServerStep({
  mode,
  zipName,
  checksumName,
  runner,
  onRunner,
}: {
  mode: SetupMode;
  zipName: string;
  checksumName: string | null;
  runner: Runner;
  onRunner: (runner: Runner) => void;
}) {
  return (
    <div className="space-y-6">
      <Prose>
        {mode === "solo"
          ? "On this computer, a home server, or a small VPS if you want the vault on more than one device. You need Docker, or Node.js 22 and a MongoDB."
          : "On any machine your team can reach — a cloud VM, a droplet, a box in the office. You need Docker, or Node.js 22 and a MongoDB you control."}{" "}
        Unpack the server bundle and generate its secrets:
      </Prose>

      <Command code={unpackCommand(zipName)} title="Unpack and configure" />
      {checksumName && (
        <p className="text-sm text-[var(--color-fg-muted)]">
          Check the download first, if you like:{" "}
          <code className="rounded bg-[var(--color-surface-2)] px-1.5 py-0.5 font-mono text-[0.8125rem] text-[var(--color-fg)]">
            sha256sum -c {checksumName}
          </code>
        </p>
      )}

      <Callout tone="key">{SETUP_SH_NOTE}</Callout>

      <div>
        <h4 className="text-sm font-semibold text-[var(--color-fg)]">Then fill in .env</h4>
        <dl className="mt-3 divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          {ENV_VARS[mode].map((row) => (
            <div key={row.name} className="grid gap-2 px-4 py-3.5 sm:grid-cols-[11rem_1fr] sm:gap-5">
              <dt className="flex items-start gap-2">
                <code className="font-mono text-sm text-[var(--color-fg)]">{row.name}</code>
                {row.required && (
                  <span className="mt-0.5 rounded-full bg-brand-500/10 px-1.5 py-px text-[0.625rem] font-medium tracking-wide text-brand-500 uppercase dark:bg-brand-400/15 dark:text-[#8fc7ab]">
                    Set
                  </span>
                )}
              </dt>
              <dd className="text-[0.9375rem] leading-relaxed text-[var(--color-fg-muted)]">{row.body}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div>
        <h4 className="mb-1 text-sm font-semibold text-[var(--color-fg)]">And start it</h4>
        <Tabs
          label="How to run the server"
          value={runner}
          onChange={onRunner}
          items={[
            { id: "docker", label: "Docker" },
            { id: "node", label: "Node.js" },
            { id: "pm2", label: "pm2" },
          ]}
        >
          <Command code={START_COMMANDS[runner]} title={runner === "docker" ? "API + MongoDB" : "API only"} />
          <p className="mt-3 text-sm text-[var(--color-fg-muted)]">
            {runner === "docker" &&
              "Starts the API and its own MongoDB, bound to this machine only. Data lives in a Docker volume and survives restarts."}
            {runner === "node" && "Runs in the foreground — put it under systemd, or use pm2 to keep it alive."}
            {runner === "pm2" && "Keeps one API process running and restarts it on reboot."}
            {mode === "solo" && " The server answers on http://localhost:4000."}
          </p>
        </Tabs>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- primitives ---

function ModeSwitch({ mode, onChange }: { mode: SetupMode; onChange: (mode: SetupMode) => void }) {
  const icons = { solo: User, team: Users } as const;

  return (
    <div role="radiogroup" aria-label="Who is it for" className="mt-10 grid gap-4 sm:grid-cols-2">
      {(Object.keys(MODES) as SetupMode[]).map((id) => {
        const item = MODES[id];
        const Icon = icons[id];
        const selected = id === mode;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(id)}
            className={cn(
              "relative cursor-pointer rounded-2xl border p-6 text-left transition-[border-color,background-color,box-shadow]",
              selected
                ? "border-[var(--color-fg)] bg-[var(--color-surface)] shadow-[0_1px_0_var(--color-border),0_18px_40px_-24px_rgb(0_0_0/0.35)]"
                : "border-[var(--color-border)] bg-transparent hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface)]",
            )}
          >
            <span
              className={cn(
                "absolute top-5 right-5 flex h-5 w-5 items-center justify-center rounded-full border transition-colors",
                selected
                  ? "border-[var(--color-fg)] bg-[var(--color-fg)] text-[var(--color-bg)]"
                  : "border-[var(--color-border-strong)]",
              )}
            >
              {selected && <Check className="h-3 w-3" strokeWidth={3} />}
            </span>
            <span className="flex items-center gap-2 text-sm font-medium text-[var(--color-fg-muted)]">
              <Icon className="h-4 w-4" />
              {item.label}
            </span>
            <span className="mt-3 block font-display text-2xl tracking-tight text-[var(--color-fg)]">
              {item.title}
            </span>
            <span className="mt-2 block text-[0.9375rem] leading-relaxed text-[var(--color-fg-muted)]">
              {item.body}
            </span>
            <span className="mt-4 block space-y-1.5">
              {item.points.map((point) => (
                <span key={point} className="flex items-start gap-2 text-sm text-[var(--color-fg-muted)]">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500 dark:text-[#8fc7ab]" />
                  {point}
                </span>
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Step({
  number,
  title,
  last,
  children,
}: {
  number: number;
  title: string;
  last: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="relative grid grid-cols-[2.75rem_1fr] gap-5 sm:grid-cols-[4rem_1fr] sm:gap-8">
      <div className="relative flex justify-center">
        <span className="relative z-10 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border-strong)] bg-[var(--color-bg)] font-display text-xl text-[var(--color-fg)] sm:h-14 sm:w-14 sm:text-2xl">
          {String(number).padStart(2, "0")}
        </span>
        {!last && (
          <span aria-hidden className="absolute top-11 bottom-0 w-px bg-[var(--color-border)] sm:top-14" />
        )}
      </div>
      <div className={cn("min-w-0 pt-2 sm:pt-3.5", !last && "pb-14")}>
        <h3 className="text-xl font-semibold tracking-tight text-[var(--color-fg)] sm:text-2xl">{title}</h3>
        <div className="mt-5">{children}</div>
      </div>
    </li>
  );
}

function Command({ code, title }: { code: string; title: string }) {
  return (
    <CodePanel
      code={code}
      title={title}
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm"
    />
  );
}

function Callout({ tone, children }: { tone: "warn" | "key"; children: React.ReactNode }) {
  const Icon = tone === "warn" ? AlertTriangle : KeyRound;
  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border px-4 py-3.5 text-[0.9375rem] leading-relaxed",
        tone === "warn"
          ? "border-amber-600/25 bg-amber-500/[0.06] text-[var(--color-fg-muted)] dark:border-amber-400/25"
          : "border-brand-500/20 bg-brand-500/[0.05] text-[var(--color-fg-muted)] dark:border-brand-400/25",
      )}
    >
      <Icon
        className={cn(
          "mt-1 h-4 w-4 shrink-0",
          tone === "warn" ? "text-amber-600 dark:text-amber-400" : "text-brand-500 dark:text-[#8fc7ab]",
        )}
      />
      <div>{children}</div>
    </div>
  );
}

function MiniCard({
  title,
  index,
  children,
}: {
  title: string;
  index?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-[var(--color-fg)]">
        {index !== undefined && (
          <span className="font-mono text-xs text-[var(--color-fg-subtle)]">{String(index).padStart(2, "0")}</span>
        )}
        {title}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-fg-muted)]">{children}</p>
    </div>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return <p className="text-[1.0625rem] leading-relaxed text-[var(--color-fg-muted)]">{children}</p>;
}

function BulletList({ items }: { items: readonly string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-[1.0625rem] leading-relaxed text-[var(--color-fg-muted)]">
          <span aria-hidden className="mt-[0.7rem] h-1 w-1 shrink-0 rounded-full bg-[var(--color-fg-subtle)]" />
          {item}
        </li>
      ))}
    </ul>
  );
}

function NumberedList({ items }: { items: readonly string[] }) {
  return (
    <ol className="space-y-3.5">
      {items.map((item, index) => (
        <li key={item} className="flex gap-3.5 text-[1.0625rem] leading-relaxed text-[var(--color-fg-muted)]">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-2)] font-mono text-xs text-[var(--color-fg)]">
            {index + 1}
          </span>
          {item}
        </li>
      ))}
    </ol>
  );
}
