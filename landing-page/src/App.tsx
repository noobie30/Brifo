import { useEffect } from "react";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { HowItWorks } from "./components/HowItWorks";
import { Integrations } from "./components/Integrations";
import { CTA } from "./components/CTA";
import { Footer } from "./components/Footer";
import { registerWebMCPTools } from "./lib/webmcp";
import { initScrollTracking } from "./lib/analytics";

export function App() {
  useEffect(() => {
    void registerWebMCPTools();
  }, []);

  useEffect(() => initScrollTracking(), []);

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 antialiased">
      <Header />
      <Hero />
      <HowItWorks />
      <Integrations />
      <CTA />
      <Footer />
    </div>
  );
}
