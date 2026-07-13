import { SITE } from "@/constants/site";

export const siteMetadata = {
  title: {
    default: "Cloak — Zero-Knowledge Secrets for Developers",
    template: "%s · Cloak",
  },
  description: SITE.description,
  keywords: [
    "secrets manager",
    "password vault",
    "zero-knowledge",
    "developer tools",
    "env files",
    "dotenvx",
    "Tauri",
    "open source",
    "API keys",
    "desktop app",
  ],
  authors: [{ name: SITE.author, url: SITE.repo }],
  creator: SITE.author,
  metadataBase: new URL(SITE.url),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE.url,
    siteName: SITE.name,
    title: "Cloak — Zero-Knowledge Secrets for Developers",
    description: SITE.description,
  },
  twitter: {
    card: "summary_large_image" as const,
    title: "Cloak — Zero-Knowledge Secrets for Developers",
    description: SITE.description,
    creator: `@${SITE.author}`,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large" as const,
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: SITE.url,
  },
};

export function getJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE.name,
    description: SITE.description,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Windows, macOS, Linux",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    license: "https://opensource.org/licenses/MIT",
    codeRepository: SITE.repo,
    programmingLanguage: ["TypeScript", "Rust"],
  };
}
