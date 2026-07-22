import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Hero } from "@/components/sections/hero";
import { SocialProofSection } from "@/components/sections/social-proof";
import { ProductExperienceSection } from "@/components/sections/product-experience";
import { WorkflowSection } from "@/components/sections/workflow";
import { FeaturesSection } from "@/components/sections/features";
import { WhySection } from "@/components/sections/why";
import { TestimonialsSection } from "@/components/sections/testimonials";
import { StatsSection } from "@/components/sections/stats";
import { ShowcaseSection } from "@/components/sections/showcase";
import { FAQSection } from "@/components/sections/faq-section";
import { FinalCTA } from "@/components/sections/final-cta";
import { getGitHubData } from "@/lib/github";

export default async function HomePage() {
  const github = await getGitHubData();

  return (
    <>
      <Navbar repo={github.repo} />
      <main>
        <Hero release={github.latestRelease} />
        <SocialProofSection />
        <ProductExperienceSection />
        <WhySection />
        <WorkflowSection />
        <FeaturesSection />
        <TestimonialsSection />
        <StatsSection />
        <ShowcaseSection />
        <FAQSection />
        <FinalCTA release={github.latestRelease} />
      </main>
      <Footer />
    </>
  );
}
