import Link from "next/link";
import Image from "next/image";
import { SITE, NAV_LINKS } from "@/constants/site";
import { SectionGlow } from "@/components/ui/section-glow";

export function Footer() {
  return (
    <footer className="relative border-t border-[var(--color-border)] bg-[var(--color-surface)]">
      <SectionGlow variant="alt" />
      <div className="container-wide relative py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <Image src="/logo.svg" alt="" width={28} height={28} />
              <span className="text-lg font-semibold">{SITE.name}</span>
            </Link>
            <p className="mt-4 max-w-md text-base leading-relaxed text-[var(--color-fg-muted)]">
              Zero-knowledge secrets manager for developers. Native desktop app. MIT licensed.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {["Tauri 2", "Rust", "React 19", "MIT"].map((tag) => (
                <span
                  key={tag}
                  className="border border-[var(--color-border)] px-2.5 py-1 font-mono text-xs text-[var(--color-fg-muted)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
              Product
            </p>
            <ul className="mt-4 space-y-2.5 text-base">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <a href="#download" className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">
                  Download
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
              Repository
            </p>
            <ul className="mt-4 space-y-2.5 text-base">
              <li>
                <a href={SITE.repo} target="_blank" rel="noopener noreferrer" className="link-subtle">
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href={`${SITE.repo}/releases`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-subtle"
                >
                  Releases
                </a>
              </li>
              <li>
                <a
                  href={`${SITE.repo}/blob/main/LICENSE`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-subtle"
                >
                  {SITE.license} License
                </a>
              </li>
            </ul>
          </div>
        </div>

        <p className="mt-12 border-t border-[var(--color-border)] pt-8 text-sm text-[var(--color-fg-subtle)]">
          © {new Date().getFullYear()} {SITE.name}. Built with care for developers who own their secrets.
        </p>
      </div>
    </footer>
  );
}
