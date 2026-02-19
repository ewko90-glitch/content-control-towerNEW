import Link from "next/link";

const columns = [
  {
    title: "Funkcje",
    links: [
      { label: "AI Generator", href: "#funkcje" },
      { label: "Publikator", href: "#funkcje" },
      { label: "Social Inbox", href: "#funkcje" },
      { label: "Analityka", href: "#funkcje" },
      { label: "Zarządzanie Blogiem", href: "#seo" },
      { label: "SEO i słowa kluczowe", href: "#seo" },
      { label: "Auto-moderacja", href: "#funkcje" },
    ],
  },
  {
    title: "Platformy",
    links: [
      { label: "Instagram", href: "#platformy" },
      { label: "Facebook", href: "#platformy" },
      { label: "LinkedIn", href: "#platformy" },
      { label: "TikTok", href: "#platformy" },
      { label: "X (Twitter)", href: "#platformy" },
    ],
  },
  {
    title: "Firma",
    links: [
      { label: "Cennik", href: "#cennik" },
      { label: "FAQ", href: "#faq" },
      { label: "Blog", href: "/blog" },
      { label: "Kontakt", href: "/kontakt" },
    ],
  },
  {
    title: "Prawne",
    links: [
      { label: "Regulamin", href: "/regulamin" },
      { label: "Polityka prywatności", href: "/polityka-prywatnosci" },
      { label: "RODO", href: "/rodo" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50">
      {/* CTA strip */}
      <div className="bg-[#5B7CFA] py-16">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-bold text-white md:text-4xl">Testuj przez 14 dni za darmo</h2>
          <p className="mt-3 text-blue-100">14 dni pełnego dostępu. Zacznij w 60 sekund.</p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/auth/register"
              className="rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-[#5B7CFA] transition-opacity hover:opacity-90"
            >
              Rozpocznij okres próbny
            </Link>
            <Link
              href="/auth/login"
              className="rounded-xl border border-white/40 px-8 py-3.5 text-base font-semibold text-white transition-opacity hover:opacity-90"
            >
              Zaloguj się
            </Link>
          </div>
        </div>
      </div>

      {/* Links */}
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#5B7CFA]">
                <span className="text-sm font-bold text-white">S</span>
              </div>
              <span className="font-bold text-gray-900">Social AI Studio</span>
            </div>
            <p className="mt-3 text-sm text-gray-500">Zrobione w Polsce 🇵🇱<br />dla marketerów i agencji.</p>
          </div>

          {/* Columns */}
          {columns.map((col) => (
            <div key={col.title}>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">{col.title}</p>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="text-sm text-gray-600 transition-colors hover:text-gray-900">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-gray-200 pt-8 text-center text-sm text-gray-400">
          © 2026 Social AI Studio. Wszelkie prawa zastrzeżone.
        </div>
      </div>
    </footer>
  );
}