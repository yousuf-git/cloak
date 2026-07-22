"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Github, Menu, X } from "lucide-react";
import { motion, useScroll, useMotionValueEvent } from "motion/react";
import { NAV_LINKS, SITE } from "@/constants/site";
import { ThemeToggle } from "@/components/theme-provider";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { GitHubRepoStats } from "@/types/github";

interface NavbarProps {
  repo: GitHubRepoStats | null;
}

export function Navbar({ repo }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (y) => {
    setScrolled(y > 24);
  });

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-[background-color,border-color] duration-300",
        scrolled
          ? "border-b border-[var(--color-border)] bg-[var(--color-bg)]/92 backdrop-blur-sm"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <nav className="container-wide flex h-[4.25rem] items-center justify-between">
        <div className="flex items-center gap-12">
          <Link href="/" className="group flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt=""
              width={64}
              height={64}
              className="h-8 w-8 rounded-full"
              priority
              quality={100}
            />
            <span className="font-display text-2xl tracking-tight">{SITE.name}</span>
          </Link>

          <div className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="link-underline inline-flex items-center gap-1 px-3 py-2 text-[0.9375rem] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              >
                {link.label}
                {link.label === "Download" && <ArrowRight className="h-3.5 w-3.5" />}
              </Link>
            ))}
          </div>
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <ThemeToggle />
          <MagneticButton href={SITE.repo} size="md" external>
            <Github className="h-4 w-4" />
            Open Source
          </MagneticButton>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)]"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-t border-[var(--color-border)] bg-[var(--color-bg)] px-6 py-6 lg:hidden"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="block py-3 text-lg text-[var(--color-fg-muted)]"
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-6 flex gap-3 border-t border-[var(--color-border)] pt-6">
            <MagneticButton href={SITE.repo} size="md" external className="flex-1">
              <Github className="h-4 w-4" />
              Open Source
            </MagneticButton>
          </div>
        </motion.div>
      )}
    </header>
  );
}
