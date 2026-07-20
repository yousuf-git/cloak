"use client";

/**
 * Each animation file is used EXACTLY once on the landing page.
 * Never reuse a path — pick another asset or add a new unique file.
 */
export const LOTTIE_ONCE = {
  /** Hero — was exposure (fingerprint / reveal scene) */
  hero: "/lottie/fingerprint.json",
  /** Product experience */
  product: "/lottie/data-protection.json",
  /** Workflow 01 · Derive */
  derive: "/lottie/biometric.json",
  /** Features · Cryptography */
  crypto: "/lottie/security-shield.json",
  /** Features · dotenvx */
  dotenvx: "/lottie/cyber-security.json",
  /** Features · Exposure model */
  exposure: "/lottie/secure-lock.json",
  /** Final CTA */
  cta: "/lottie/final-cta.json",
} as const;
