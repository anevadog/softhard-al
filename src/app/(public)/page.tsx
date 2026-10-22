import { ContactSection } from "@/components/site/contact-section";
import { Hero } from "@/components/site/hero";
import { HowItWorks } from "@/components/site/how-it-works";
import { ServicesSection } from "@/components/site/services-section";

export default function HomePage() {
  return (
    <>
      <Hero />
      <ServicesSection />
      <HowItWorks />
      <ContactSection />
    </>
  );
}
