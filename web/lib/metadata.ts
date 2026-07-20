import { SITE } from "@/constants/site";

function getSiteOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;

  return SITE.url;
}

function getMetadataBase(): URL {
  return new URL(getSiteOrigin());
}

const ogImage = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: "Cloak — Secrets that never leave your machine",
  type: "image/png",
} as const;

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
  metadataBase: getMetadataBase(),
  openGraph: {
    type: "website" as const,
    locale: "en_US",
    url: "/",
    siteName: SITE.name,
    title: "Cloak — Zero-Knowledge Secrets for Developers",
    description: SITE.description,
    images: [ogImage],
  },
  twitter: {
    card: "summary_large_image" as const,
    title: "Cloak — Zero-Knowledge Secrets for Developers",
    description: SITE.description,
    creator: `@${SITE.author}`,
    images: ["/og.png"],
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
    canonical: "/",
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
    image: ogImage.url,
  };
}
