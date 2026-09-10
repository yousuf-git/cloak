import type { Metadata } from "next";
import { Geist, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { getGitHubData } from "@/lib/github";
import { getJsonLd, siteMetadata } from "@/lib/metadata";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  ...siteMetadata,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16.png", type: "image/png", sizes: "16x16" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/logo.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = getJsonLd();
  // Same cached request the pages make, so this costs nothing extra.
  const github = await getGitHubData();

  return (
    <html
      lang="en"
      // Lets Next.js switch off the smooth scrolling below for route changes,
      // so a new page starts at the top instantly instead of gliding there.
      data-scroll-behavior="smooth"
      className={`${geist.variable} ${instrument.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('cloak-theme');document.documentElement.classList.toggle('dark',s==='dark')}catch(e){}})();`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      {/* Extensions that edit the page before React loads — Grammarly stamps
          data-gr-ext-installed on the body — otherwise fail hydration for the
          whole tree. This suppresses that one element's attribute check only. */}
      <body className="min-h-screen font-sans antialiased" suppressHydrationWarning>
        <ThemeProvider>
          {/* Here rather than in each page: Next.js skips sticky elements when
              choosing where to scroll after navigation, and a sticky header at
              the top of a page made it keep the old scroll position. */}
          <Navbar repo={github.repo} />
          {children}
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
