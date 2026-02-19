import { Cennik } from "@/components/marketing/Cennik";
import { Footer } from "@/components/marketing/Footer";
import { Funkcjonalnosci } from "@/components/marketing/Funkcjonalnosci";
import { Hero } from "@/components/marketing/Hero";
import { JakToDziala } from "@/components/marketing/JakToDziala";
import { Tokeny } from "@/components/marketing/Tokeny";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#F6F8FB]">
      <Hero />
      <JakToDziala />
      <Funkcjonalnosci />
      <Cennik />
      <Tokeny />
      <Footer />
    </main>
  );
}