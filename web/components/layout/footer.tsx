import Link from "next/link";
import Image from "next/image";
import { SITE, NAV_LINKS } from "@/constants/site";

export function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="container-wide section-pad !pb-10 !pt-20 sm:!pt-24">
        <div className="grid gap-14 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5">
              <Image
                src="/logo.png"
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 rounded-full"
              />
              <span className="font-display text-3xl tracking-tight">{SITE.name}</span>
            </Link>
            <p className="mt-6 max-w-sm text-[1.0625rem] leading-relaxed text-[var(--color-fg-muted)]">
              {SITE.description}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium tracking-[0.14em] text-[var(--color-fg-subtle)] uppercase">
              Product
            </p>
            <ul className="mt-5 space-y-3">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="link-underline text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-medium tracking-[0.14em] text-[var(--color-fg-subtle)] uppercase">
              Repository
            </p>
            <ul className="mt-5 space-y-3">
              <li>
                <a
                  href={SITE.repo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-underline text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                >
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href={`${SITE.repo}/releases`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-underline text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                >
                  Releases
                </a>
              </li>
              <li>
                <a
                  href={`${SITE.repo}/blob/main/LICENSE`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-underline text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                >
                  {SITE.license} License
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-[var(--color-border)] pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--color-fg-subtle)]">
            © {new Date().getFullYear()} {SITE.name}. Open source under {SITE.license}.
          </p>
          <p className="font-mono text-xs text-[var(--color-fg-subtle)]">
            Plaintext never leaves your device
          </p>
        </div>
      </div>
    </footer>
  );
}
