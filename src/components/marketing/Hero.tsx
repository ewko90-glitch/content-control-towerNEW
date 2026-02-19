import Link from "next/link";

const stats = [
  { value: "12 000+", label: "aktywnych użytkowników" },
  { value: "5 platform", label: "w jednym miejscu" },
  { value: "3x szybciej", label: "tworzysz treści z AI" },
];

const platformPills = ["Instagram", "Facebook", "LinkedIn", "TikTok", "X (Twitter)"];

const posts = [
  {
    borderClass: "border-l-[#0A66C2]",
    title: "Trendy AI w marketingu 2026",
    meta: "LinkedIn · 10:00",
    badge: "Gotowy",
    badgeClass: "bg-green-100 text-green-700",
  },
  {
    borderClass: "border-l-[#1A9E6E]",
    title: "Poradnik SEO dla startupów",
    meta: "Blog · 14:00",
    badge: "Szkic",
    badgeClass: "bg-yellow-100 text-yellow-700",
  },
  {
    borderClass: "border-l-[#C13584]",
    title: "Friday tip content plan",
    meta: "Instagram · 11:00",
    badge: "Plan",
    badgeClass: "bg-blue-100 text-blue-700",
  },
];

export function Hero() {
  return (
    <section className="overflow-hidden bg-white">
      <div className="mx-auto max-w-7xl px-6 pb-12 pt-16 md:pt-24">
        <div className="flex flex-col items-center text-center">
          {/* Badge */}
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#E0E7FF] bg-[#EEF2FF] px-4 py-1.5 text-sm font-medium text-[#5B7CFA]">
            <span className="h-2 w-2 rounded-full bg-[#5B7CFA]" />
            Nowe: Asystent AI do social media w Polsce
          </span>

          {/* Headline */}
          <h1 className="max-w-4xl text-4xl font-extrabold leading-tight tracking-tight text-gray-900 md:text-6xl">
            Kompletne narzędzie
            {" "}do social media{" "}
            <span className="text-[#5B7CFA]">zasilane AI</span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg text-gray-500">
            Planuj, twórz i publikuj treści na Instagram, Facebook, LinkedIn, TikTok i X —
            wszystko w jednym panelu. AI pisze za Ciebie, Ty tylko zatwierdzasz.
          </p>

          {/* CTA */}
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
            <Link
              href="https://content-control-tower-new.vercel.app/auth/register"
              className="rounded-xl bg-[#5B7CFA] px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#5B7CFA]/25 transition-all hover:bg-[#4a6ef0]"
            >
              Zacznij za darmo — 14 dni
            </Link>
            <Link
              href="/auth/login"
              className="rounded-xl border border-gray-200 bg-white px-8 py-3.5 text-base font-semibold text-gray-700 transition-all hover:bg-gray-50"
            >
              Zaloguj się
            </Link>
          </div>
          <p className="mt-3 text-sm text-gray-400">14 dni za darmo. Zacznij w 60 sekund. Anuluj kiedy chcesz.</p>

          {/* Platform pills */}
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {platformPills.map((p) => (
              <span
                key={p}
                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600"
              >
                {p}
              </span>
            ))}
          </div>

          {/* Stats */}
          <div className="mt-14 grid grid-cols-3 gap-8 border-t border-gray-100 pt-10 w-full max-w-2xl">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-2xl font-bold text-gray-900 md:text-3xl">{s.value}</p>
                <p className="mt-1 text-sm text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mock dashboard */}
      <div className="mx-auto max-w-5xl px-6 pb-16">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-2xl">
          <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span className="h-3 w-3 rounded-full bg-yellow-400" />
            <span className="h-3 w-3 rounded-full bg-green-400" />
            <div className="mx-4 flex-1 rounded bg-gray-100 px-3 py-1 text-xs text-gray-400">
              app.social-ai-studio.pl
            </div>
          </div>
          <div className="grid grid-cols-4">
            <div className="col-span-1 border-r border-gray-200 bg-white p-4">
              <div className="mb-4 h-5 w-20 rounded bg-gray-100" />
              {["Dashboard", "Kalendarz", "AI Generator", "Inbox", "Analityka"].map((item) => (
                <div
                  key={item}
                  className={`mb-1 rounded-lg px-3 py-2 text-xs ${
                    item === "AI Generator"
                      ? "bg-[#EEF2FF] font-semibold text-[#5B7CFA]"
                      : "text-gray-500"
                  }`}
                >
                  {item}
                </div>
              ))}
            </div>
            <div className="col-span-3 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="h-5 w-32 rounded bg-gray-200" />
                <div className="h-8 w-24 rounded-lg bg-[#5B7CFA]" />
              </div>
              <div className="mb-4 grid grid-cols-3 gap-3">
                {[{l:"Opublikowane",v:"24",c:"text-green-600"},{l:"Zaplanowane",v:"8",c:"text-blue-600"},{l:"Szkice",v:"5",c:"text-yellow-600"}].map((card) => (
                  <div key={card.l} className="rounded-xl border border-gray-200 bg-white p-3">
                    <p className="text-xs text-gray-400">{card.l}</p>
                    <p className={`text-2xl font-bold ${card.c}`}>{card.v}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                {posts.map((post) => (
                  <div key={post.title} className={`flex items-center justify-between border-t border-gray-100 py-2 border-l-4 pl-3 ${post.borderClass}`}>
                    <div>
                      <p className="text-xs font-medium text-gray-800">{post.title}</p>
                      <p className="text-xs text-gray-400">{post.meta}</p>
                    </div>
                    <span className={`ml-3 rounded-full px-2 py-0.5 text-xs font-medium ${post.badgeClass}`}>{post.badge}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}