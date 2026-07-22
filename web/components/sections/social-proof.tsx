"use client";

import { Fingerprint, Lock } from "lucide-react";
import { SOCIAL_PROOF } from "@/content/site-content";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { TauriIcon, RustIcon, ReactIcon, DotenvIcon } from "@/components/ui/brand-icons";

const LOGO_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  tauri: TauriIcon,
  rust: RustIcon,
  react: ReactIcon,
  dotenv: DotenvIcon,
  argon2: Fingerprint,
  xchacha: Lock,
};

export function SocialProofSection() {
  return (
    <section className="border-y border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="container-wide py-14 sm:py-16">
        <Reveal>
          <p className="text-center text-xs font-medium tracking-[0.16em] text-[var(--color-fg-subtle)] uppercase">
            {SOCIAL_PROOF.label}
          </p>
        </Reveal>

        <Stagger className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 sm:gap-x-14" stagger={0.06}>
          {SOCIAL_PROOF.logos.map((logo) => {
            const Icon = LOGO_ICONS[logo.icon];
            return (
              <StaggerItem key={logo.icon}>
                <span className="flex items-center gap-2.5 text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]">
                  {Icon && <Icon className="h-5 w-5 shrink-0" />}
                  <span className="font-mono text-sm tracking-wide sm:text-[0.9375rem]">
                    {logo.label}
                  </span>
                </span>
              </StaggerItem>
            );
          })}
        </Stagger>
      </div>
    </section>
  );
}
