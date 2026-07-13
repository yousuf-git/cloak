import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Hero } from "@/components/sections/hero";
import { OverviewSection } from "@/components/sections/overview";
import { FeaturesSection } from "@/components/sections/features";
import { ArchitectureSection } from "@/components/sections/architecture";
import { SecuritySection, TechStackSection } from "@/components/sections/security";
import { InstallSection, ScriptsSection, ComparisonSection } from "@/components/sections/install";
import { DownloadSection } from "@/components/ui/download-button";
import { FAQSection } from "@/components/sections/faq-section";
import { Section } from "@/components/ui/section";
import { FAQ_ITEMS } from "@/content/site-content";
import { detectPlatform, getDownloadUrl, getGitHubData } from "@/lib/github";
import { headers } from "next/headers";

export default async function HomePage() {
  const github = await getGitHubData();
  const headersList = await headers();
  const userAgent = headersList.get("user-agent") ?? "";
  const platform = detectPlatform(userAgent);
  const download = getDownloadUrl(github.latestRelease, platform);

  return (
    <>
      <Navbar downloadHref={download.url} repo={github.repo} />
      <main>
        <Hero release={github.latestRelease} />

        <OverviewSection />
        <FeaturesSection />
        <ArchitectureSection />
        <SecuritySection />
        <TechStackSection />
        <InstallSection />
        <ScriptsSection />
        <ComparisonSection />

        <Section id="download" label="Download" title="Get Cloak" alt accent>
          <DownloadSection release={github.latestRelease} />
        </Section>

        <FAQSection items={FAQ_ITEMS} />
      </main>
      <Footer />
    </>
  );
}
