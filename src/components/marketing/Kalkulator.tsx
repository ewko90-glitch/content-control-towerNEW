"use client";

import Link from "next/link";
import { useState } from "react";

const platforms = [
  { id: "instagram", name: "Instagram", gradient: true, bg: "from-purple-500 to-pink-500", letter: "IG" },
  { id: "facebook", name: "Facebook", gradient: false, bg: "bg-blue-600", letter: "FB" },
  { id: "linkedin", name: "LinkedIn", gradient: false, bg: "bg-blue-700", letter: "in" },
  { id: "tiktok", name: "TikTok", gradient: false, bg: "bg-gray-900", letter: "TT" },
  { id: "x", name: "X / Twitter", gradient: false, bg: "bg-gray-800", letter: "𝕏" },
];

const interactionLevels = [
  { label: "1–10", minutesPerDay: 10 },
  { label: "11–50", minutesPerDay: 30 },
  { label: "51–100", minutesPerDay: 60 },
  { label: "101–200", minutesPerDay: 100 },
  { label: "200+", minutesPerDay: 150 },
];

export function Kalkulator() {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["instagram", "facebook"]);
  const [interactionLevel, setInteractionLevel] = useState(1);

  const togglePlatform = (id: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const count = selectedPlatforms.length || 1;
  const minutesPerDay = interactionLevels[interactionLevel].minutesPerDay;
  const hoursPerMonth = Math.round((count * minutesPerDay * 22) / 60);

  return (
    <section className="bg-[#F8FAFC] py-24">
      <div className="mx-auto max-w-5xl px-6">
        {/* Header */}
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">
            Oblicz,{" "}
            <span className="text-[#5B7CFA]">ile czasu zaoszczędzisz</span>
          </h2>
          <p className="mt-4 text-gray-500">
            Zobacz, ile czasu możesz zaoszczędzić ze swoim zespołem, korzystając z Social AI Studio.
          </p>
        </div>

        {/* Calculator card */}
        <div className="overflow-hidden rounded-3xl border border-gray-200 shadow-2xl md:grid md:grid-cols-2">
          {/* Left — inputs */}
          <div className="bg-white p-8 md:p-10">
            <p className="font-semibold text-gray-900">
              Z których platform social media korzystasz w swojej firmie?
            </p>

            <div className="mt-5 flex flex-wrap gap-4">
              {platforms.map((p) => {
                const selected = selectedPlatforms.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePlatform(p.id)}
                    title={p.name}
                    className={`relative flex h-14 w-14 items-center justify-center rounded-2xl text-sm font-bold text-white transition-all duration-200 ${
                      p.gradient ? `bg-gradient-to-br ${p.bg}` : p.bg
                    } ${selected ? "opacity-100 ring-2 ring-[#5B7CFA] ring-offset-2" : "opacity-35"}`}
                  >
                    {p.letter}
                    {selected && (
                      <span className="absolute -bottom-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#5B7CFA] text-[10px] font-bold text-white shadow">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <p className="mt-8 font-semibold text-gray-900">
              Ile masz interakcji* z użytkownikami dziennie?
            </p>

            {/* Slider */}
            <div className="mt-5">
              <input
                type="range"
                min={0}
                max={4}
                step={1}
                value={interactionLevel}
                onChange={(e) => setInteractionLevel(Number(e.target.value))}
                className="w-full cursor-pointer accent-[#5B7CFA]"
              />
              <div className="mt-2 flex justify-between text-sm">
                {interactionLevels.map((l, i) => (
                  <span
                    key={l.label}
                    className={`transition-colors ${
                      interactionLevel === i
                        ? "font-bold text-[#5B7CFA]"
                        : "text-gray-400"
                    }`}
                  >
                    {l.label}
                  </span>
                ))}
              </div>
            </div>

            <p className="mt-8 text-xs leading-relaxed text-gray-400">
              *komentarzy, pytań, recenzji i wiadomości prywatnych, które
              wymagają moderacji na profilach firmy.
            </p>
          </div>

          {/* Right — result */}
          <div className="flex flex-col items-center justify-center bg-[#5B7CFA] p-8 text-center md:p-10">
            <p className="text-lg font-medium text-blue-100">
              Miesięcznie oszczędzasz:
            </p>
            <p
              key={hoursPerMonth}
              className="mt-2 text-[7rem] font-black leading-none text-white tabular-nums"
            >
              {hoursPerMonth}
            </p>
            <p className="text-3xl font-bold text-white">godzin</p>

            <Link
              href="/auth/register"
              className="mt-8 inline-block rounded-2xl bg-yellow-400 px-8 py-4 text-base font-bold text-gray-900 transition-colors hover:bg-yellow-300"
            >
              Sprawdź w praktyce – za darmo
            </Link>
            <p className="mt-3 text-sm text-blue-100">
              14 dni pełnego dostępu. Zero ryzyka.
              <br />
              Zacznij już dziś i przekonaj się sam.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
