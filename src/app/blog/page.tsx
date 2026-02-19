import Link from "next/link";

const posts = [
  {
    slug: "jak-ai-zmienia-social-media-marketing",
    category: "AI i Marketing",
    title: "Jak AI zmienia social media marketing w 2026 roku",
    excerpt:
      "Generatywna AI nie jest już ciekawostką — to standard pracy marketerów. Sprawdź, jak wykorzystać ją, żeby publikować 3x szybciej bez utraty jakości.",
    readTime: "7 min",
    date: "18 lutego 2026",
  },
  {
    slug: "instagram-algorytm-2026",
    category: "Instagram",
    title: "Algorytm Instagrama w 2026: co musisz wiedzieć",
    excerpt:
      "Instagram drastycznie zmienił sposób promowania postów. Oto aktualne zasady, które decydują o tym, czy Twoje treści dotrą do obserwujących.",
    readTime: "5 min",
    date: "15 lutego 2026",
  },
  {
    slug: "seo-dla-social-media-agencji",
    category: "SEO",
    title: "SEO dla agencji social media: jak zdobywać klientów z Google",
    excerpt:
      "Blog firmowy to najtańszy kanał pozyskania klientów B2B. Pokazujemy, jakie frazy wpisują właściciele firm szukający agencji social media.",
    readTime: "9 min",
    date: "12 lutego 2026",
  },
  {
    slug: "linkedin-b2b-posty-ktore-sprzedaja",
    category: "LinkedIn",
    title: "LinkedIn B2B: wzory postów, które generują leady",
    excerpt:
      "10 sprawdzonych formatów postów na LinkedIn razem z przykładami. Skopiuj strukturę, dostosuj do swojej marki i zacznij dostawać zapytania.",
    readTime: "6 min",
    date: "10 lutego 2026",
  },
  {
    slug: "google-search-console-dla-marketerow",
    category: "SEO",
    title: "Google Search Console dla marketerów: przewodnik od zera",
    excerpt:
      "GSC to kopalnia danych, z której korzysta mniej niż 20% marketerów. Tłumaczymy jak czytać raporty i które metryki naprawdę mają znaczenie.",
    readTime: "11 min",
    date: "7 lutego 2026",
  },
  {
    slug: "tiktok-dla-firm-b2b",
    category: "TikTok",
    title: "TikTok dla firm B2B? Tak, to działa. Oto dowód",
    excerpt:
      "Case study: agencja HR z Warszawy zdobyła 47 klientów w 3 miesiące dzięki TikTokowi. Cały proces krok po kroku.",
    readTime: "8 min",
    date: "3 lutego 2026",
  },
];

const categories = ["Wszystkie", "AI i Marketing", "SEO", "Instagram", "LinkedIn", "TikTok", "Facebook"];

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white/90 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#5B7CFA]">
              <span className="text-sm font-bold text-white">S</span>
            </div>
            <span className="text-lg font-bold text-gray-900">Social AI Studio</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">
              ← Strona główna
            </Link>
            <Link
              href="/auth/register"
              className="rounded-lg bg-[#5B7CFA] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Wypróbuj za darmo
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-[#F8FAFC] py-16 text-center">
        <div className="mx-auto max-w-3xl px-6">
          <span className="mb-4 inline-block rounded-full bg-[#EEF2FF] px-4 py-1.5 text-sm font-medium text-[#5B7CFA]">
            BLOG
          </span>
          <h1 className="text-4xl font-bold text-gray-900 md:text-5xl">
            Wiedza o social media,{" "}
            <span className="text-[#5B7CFA]">która napędza wyniki</span>
          </h1>
          <p className="mt-4 text-lg text-gray-500">
            Artykuły o AI w marketingu, SEO, strategii social media i narzędziach dla agencji i marketerów.
          </p>
        </div>
      </section>

      {/* Category filter */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-wrap gap-2">
          {categories.map((cat, i) => (
            <button
              key={cat}
              type="button"
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                i === 0
                  ? "bg-[#5B7CFA] text-white"
                  : "border border-gray-200 text-gray-600 hover:border-[#5B7CFA] hover:text-[#5B7CFA]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Posts grid */}
      <div className="mx-auto max-w-7xl px-6 pb-24">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group flex flex-col rounded-2xl border border-gray-200 bg-white overflow-hidden transition hover:shadow-lg hover:-translate-y-0.5"
            >
              {/* Placeholder image */}
              <div className="h-48 bg-gradient-to-br from-[#EEF2FF] to-[#E0E7FF] flex items-center justify-center">
                <span className="text-5xl opacity-40">
                  {post.category === "AI i Marketing" ? "🤖" :
                   post.category === "SEO" ? "🔍" :
                   post.category === "Instagram" ? "📸" :
                   post.category === "LinkedIn" ? "💼" :
                   post.category === "TikTok" ? "🎵" : "📘"}
                </span>
              </div>

              <div className="flex flex-1 flex-col p-6">
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span className="rounded-full bg-[#EEF2FF] px-3 py-1 font-medium text-[#5B7CFA]">
                    {post.category}
                  </span>
                  <span>{post.readTime} czytania</span>
                  <span>·</span>
                  <span>{post.date}</span>
                </div>
                <h2 className="mt-3 text-lg font-bold text-gray-900 group-hover:text-[#5B7CFA] transition-colors leading-snug">
                  {post.title}
                </h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-500">{post.excerpt}</p>
                <p className="mt-4 text-sm font-semibold text-[#5B7CFA]">Czytaj więcej →</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* CTA */}
      <section className="bg-[#5B7CFA] py-16 text-center">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-3xl font-bold text-white">Gotowy, żeby działać szybciej?</h2>
          <p className="mt-3 text-blue-100">
            Dołącz do 12 000+ marketerów i agencji, którzy zarządzają social media z Social AI Studio.
          </p>
          <Link
            href="/auth/register"
            className="mt-8 inline-block rounded-xl bg-yellow-400 px-8 py-4 text-base font-bold text-gray-900 hover:bg-yellow-300 transition"
          >
            Zacznij za darmo →
          </Link>
        </div>
      </section>
    </div>
  );
}
