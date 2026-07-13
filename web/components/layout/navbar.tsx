"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { NAV_LINKS, SITE } from "@/constants/site";
import { ThemeToggle } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";
import type { GitHubRepoStats } from "@/types/github";

interface NavbarProps {
  downloadHref: string;
  repo: GitHubRepoStats | null;
}

export function Navbar({ downloadHref, repo }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur-sm">
      <nav className="container-wide flex h-16 items-center justify-between">
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo.svg" alt="" width={28} height={28} className="h-7 w-7" />
            <span className="text-lg font-semibold">{SITE.name}</span>
          </Link>

          <div className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-2 text-base text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          {repo && (
            <a
              href={SITE.repo}
              target="_blank"
              rel="noopener noreferrer"
              className="text-base text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            >
              ★ {formatNumber(repo.stars)}
            </a>
          )}
          <ThemeToggle />
          <Button href={SITE.repo} variant="secondary" size="sm" external>
            GitHub
          </Button>
          <Button href={downloadHref} size="md">
            Download
          </Button>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center border border-[var(--color-border)]"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="border-t border-[var(--color-border)] px-4 py-4 lg:hidden">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="block py-2.5 text-base text-[var(--color-fg-muted)]"
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-4 flex gap-2 border-t border-[var(--color-border)] pt-4">
            <Button href={SITE.repo} variant="secondary" size="sm" external className="flex-1">
              GitHub
            </Button>
            <Button href={downloadHref} size="md" className="flex-1">
              Download
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
