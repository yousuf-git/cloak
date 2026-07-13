"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { BookOpen, Fingerprint, Github, KeyRound, Lock, Shield } from "lucide-react";
import { SITE } from "@/constants/site";
import { HERO, TERMINAL_LINES, DEV_COMMANDS } from "@/content/site-content";
import { DownloadRow } from "@/components/ui/download-button";
import { ProductWindow } from "@/components/ui/product-window";
import { CodePanel, TerminalPanel } from "@/components/ui/code-panel";
import { Button } from "@/components/ui/button";
import { CryptoBadge, SecurityBackdrop } from "@/components/ui/security-backdrop";
import { usePrefersReducedMotion } from "@/hooks/use-platform";
import type { GitHubRelease } from "@/types/github";

interface HeroProps {
  release: GitHubRelease | null;
}

const CRYPTO_STACK = [
  { label: "Argon2id", icon: <Fingerprint className="h-4 w-4" /> },
  { label: "XChaCha20-Poly1305", icon: <Shield className="h-4 w-4" /> },
  { label: "Zero-knowledge", icon: <Lock className="h-4 w-4" /> },
  { label: "dotenvx", icon: <KeyRound className="h-4 w-4" /> },
] as const;

export function Hero({ release }: HeroProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const stageInView = useInView(stageRef, { amount: 0.15, once: true });
  const reduced = usePrefersReducedMotion();

  return (
    <section className="relative overflow-hidden border-b border-[var(--color-border)] bg-[var(--color-bg)]">
      <SecurityBackdrop variant="hero" />

      {/* ── Centered editorial intro ── */}
      <div className="container-wide relative pt-16 pb-10 sm:pt-20 sm:pb-12">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto flex max-w-6xl flex-col items-center text-center"
        >
          <h1 className="hero-headline text-balance font-[family-name:var(--font-display)] text-6xl font-black tracking-[-0.045em] sm:text-7xl lg:text-8xl xl:text-[6.25rem] xl:leading-[1.02]">
            {HERO.headline}
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--color-fg-muted)] sm:text-xl">
            {HERO.subhead}
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {CRYPTO_STACK.map((item, i) => (
              <motion.div
                key={item.label}
                initial={reduced ? false : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15 + i * 0.06, duration: 0.35 }}
              >
                <CryptoBadge label={item.label} icon={item.icon} />
              </motion.div>
            ))}
          </div>

          <div className="mt-10 flex w-full flex-col items-center">
            <DownloadRow release={release} className="flex flex-col items-center" />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <Button href={SITE.repo} variant="secondary" size="md" external icon={<Github className="h-4 w-4" />}>
              View on GitHub
            </Button>
            <Button
              href={`${SITE.repo}#getting-started`}
              variant="ghost"
              size="md"
              external
              icon={<BookOpen className="h-4 w-4" />}
            >
              Read the docs
            </Button>
          </div>
        </motion.div>
      </div>

      {/* ── Cinematic product stage (bento) ── */}
      <div className="container-wide relative pb-16 sm:pb-20">
        <motion.div
          ref={stageRef}
          initial={reduced ? false : { opacity: 0, y: 32 }}
          animate={stageInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="panel relative overflow-hidden border-brand-500/15 p-4 sm:p-6"
        >
          {/* Stage header bar */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              <span className="font-mono text-sm text-[var(--color-fg-muted)]">
                cloak://vault — live preview
              </span>
            </div>
            <div className="flex gap-2 font-mono text-xs text-[var(--color-fg-subtle)]">
              <span className="border border-[var(--color-border)] px-2 py-1">Tauri 2</span>
              <span className="border border-[var(--color-border)] px-2 py-1">Rust core</span>
              <span className="hidden border border-[var(--color-border)] px-2 py-1 sm:inline">
                React 19
              </span>
            </div>
          </div>

          {/* Bento grid — product centerpiece + side panels */}
          <div className="grid gap-4 lg:grid-cols-12 lg:grid-rows-[auto_auto]">
            <motion.div
              initial={reduced ? false : { opacity: 0, scale: 0.98 }}
              animate={stageInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="lg:col-span-8 lg:row-span-2"
            >
              <ProductWindow className="h-full shadow-xl ring-1 ring-brand-500/10" />
            </motion.div>

            <motion.div
              initial={reduced ? false : { opacity: 0, x: 16 }}
              animate={stageInView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: 0.2, duration: 0.45 }}
              className="lg:col-span-4"
            >
              <TerminalPanel lines={TERMINAL_LINES.slice(0, 4)} title="setup.sh" className="h-full" />
            </motion.div>

            <motion.div
              initial={reduced ? false : { opacity: 0, x: 16 }}
              animate={stageInView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: 0.28, duration: 0.45 }}
              className="lg:col-span-4"
            >
              <CodePanel code={DEV_COMMANDS} title="development" language="shell" className="h-full" />
            </motion.div>

            <motion.div
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={stageInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.35, duration: 0.45 }}
              className="lg:col-span-12"
            >
              <CodePanel
                code={HERO.installCommand}
                title="quick install"
                language="shell"
                showCopy
              />
            </motion.div>
          </div>
        </motion.div>

        {/* Platform strip */}
        <motion.p
          initial={reduced ? false : { opacity: 0 }}
          animate={stageInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.5 }}
          className="mt-6 text-center text-base text-[var(--color-fg-muted)]"
        >
          Native desktop · Windows · macOS · Linux
        </motion.p>
      </div>
    </section>
  );
}
