import Link from "next/link";

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
    <section className="bg-white py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-16 px-6 lg:grid-cols-2">
        {/* LEFT */}
        <div>
          <span className="mb-5 inline-flex bg-[#EEF2FF] text-[#5B7CFA] rounded-full px-3 py-1 text-xs font-semibold">
            Teraz dostępne w Polsce
          </span>

          <h1 className="mt-4 text-5xl font-bold leading-tight text-[#0F172A] md:text-6xl">
            Content Control Tower
          </h1>

          <p className="mt-5 max-w-md text-base leading-relaxed text-[#475569]">
            Jedyne polskie narzędzie do zarządzania contentem z AI. Dla marketerów, agencji i twórców.
          </p>

          <div className="mt-9 flex flex-wrap gap-4">
            <Link
              href="/auth/register"
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#5B7CFA] px-7 text-sm font-semibold text-white transition-colors hover:bg-[#4F6EF5]"
            >
              Rozpocznij bezpłatnie
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white px-7 text-sm font-semibold text-[#0F172A] transition-colors hover:bg-[#F6F8FB]"
            >
              Zaloguj się
            </Link>
          </div>
        </div>

        {/* RIGHT — app mockup */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-2xl">
          <div className="mb-5 flex items-center justify-between">
            <p className="text-sm font-semibold text-[#0F172A]">Dziś do zrobienia</p>
            <span className="h-2 w-2 rounded-full bg-[#5B7CFA]" />
          </div>

          <div className="space-y-3">
            {posts.map((post) => (
              <div
                key={post.title}
                className={`flex items-center justify-between rounded-xl border border-[#E2E8F0] border-l-4 bg-[#F8FAFC] px-4 py-3 ${post.borderClass}`}
              >
                <div>
                  <p className="text-sm font-medium text-[#0F172A]">{post.title}</p>
                  <p className="text-xs text-[#94A3B8]">{post.meta}</p>
                </div>
                <span
                  className={`ml-4 flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${post.badgeClass}`}
                >
                  {post.badge}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}