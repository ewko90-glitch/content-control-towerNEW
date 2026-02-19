import { Cennik } from "@/components/marketing/Cennik";
import { Footer } from "@/components/marketing/Footer";
import { Funkcjonalnosci } from "@/components/marketing/Funkcjonalnosci";
import { Hero } from "@/components/marketing/Hero";
import { JakToDziala } from "@/components/marketing/JakToDziala";
import { Kalkulator } from "@/components/marketing/Kalkulator";
import { Navbar } from "@/components/marketing/Navbar";
import { SeoSection } from "@/components/marketing/SeoSection";
import { Tokeny } from "@/components/marketing/Tokeny";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <Hero />
      <JakToDziala />
      <Funkcjonalnosci />
      <SeoSection />
      <Kalkulator />
      <Cennik />
      <Tokeny />
      <Footer />
    </main>
  );
}