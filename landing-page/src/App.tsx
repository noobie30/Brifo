import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { Features } from "./components/Features";
import { HowItWorks } from "./components/HowItWorks";
import { Privacy } from "./components/Privacy";
import { CallToAction } from "./components/CallToAction";
import { Footer } from "./components/Footer";

export function App() {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 antialiased">
      <Header />
      <Hero />
      <Features />
      <HowItWorks />
      <Privacy />
      <CallToAction />
      <Footer />
    </div>
  );
}
