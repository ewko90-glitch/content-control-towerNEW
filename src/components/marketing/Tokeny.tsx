"use client";

import { useState } from "react";

const platforms = [
  { name: "Instagram", color: "bg-gradient-to-br from-purple-500 to-pink-500", letter: "I" },
  { name: "Facebook", color: "bg-blue-600", letter: "f" },
  { name: "LinkedIn", color: "bg-blue-700", letter: "in" },
  { name: "TikTok", color: "bg-black", letter: "♪" },
  { name: "X (Twitter)", color: "bg-gray-900", letter: "✕" },
];

const faqs = [
  {
    q: "Czy mogę zarządzać wieloma kontami?",
    a: "Tak — w planach Growth i wyższych możesz podłączyć wiele profili i przełączać się między nimi jednym kliknięciem.",
  },
  {
    q: "Jak działa asystent AI?",
    a: "Asystent AI korzysta z modelu GPT-4o mini. Piszesz temat, wybierasz ton i platformę — AI generuje gotów post w kilka sekund.",
  },
  {
    q: "Czy funkcja auto-publikacji działa niezawodnie?",
    a: "Tak, posty są publikowane przez API oficjalnych platform. Otrzymasz powiadomienie, jeśli coś pójdzie nie tak.",
  },
  {
    q: "Jak wygląda darmowy okres próbny?",
    a: "14 dni pełnego dostępu do wszystkich funkcji. Po okresie próbnym wybierasz plan dopasowany do skali swojego biznesu lub rezygnujesz — bez żadnych konsekwencji.",
  },
  {
    q: "Czy mogę używać narzędzia z zespółem?",
    a: "Oczywiście. Zapraszasz współpracowników, przypisujesz role i zatwierdzasz treści przed publikacją.",
  },
];

export function Tokeny() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <>
      {/* Platforms */}
      <section id="platformy" className="bg-[#F8FAFC] py-20">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <span className="mb-4 inline-block rounded-full bg-[#EEF2FF] px-4 py-1.5 text-sm font-medium text-[#5B7CFA]">INTEGRACJE</span>
          <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">Platformy, z którymi działa Social AI Studio</h2>
          <p className="mt-4 text-gray-500">Wszystkie główne platformy social media. W jednym miejscu.</p>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-6">
            {platforms.map((p) => (
              <div key={p.name} className="flex flex-col items-center gap-3">
                <div className={`flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-bold text-white shadow-lg ${p.color}`}>
                  {p.letter}
                </div>
                <span className="text-sm font-medium text-gray-600">{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-white py-24">
        <div className="mx-auto max-w-4xl px-6">
          <div className="text-center">
            <span className="mb-4 inline-block rounded-full bg-[#EEF2FF] px-4 py-1.5 text-sm font-medium text-[#5B7CFA]">FAQ</span>
            <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">Najczęściej zadawane pytania</h2>
          </div>

          <div className="mt-10 space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpen(open === i ? null : i)}
                  className="flex w-full items-center justify-between px-6 py-5 text-left"
                >
                  <span className="font-semibold text-gray-900">{faq.q}</span>
                  <span className={`ml-4 flex-shrink-0 text-xl text-[#5B7CFA] transition-transform ${open === i ? "rotate-45" : ""}`}>
                    +
                  </span>
                </button>
                {open === i && (
                  <div className="border-t border-gray-100 px-6 pb-5 pt-4">
                    <p className="text-gray-500 leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}