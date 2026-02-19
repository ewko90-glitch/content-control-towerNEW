"use client";

import Link from "next/link";
import { type ReactElement, useState } from "react";

// ── Types ──────────────────────────────────────────────
type Step = 1 | 2 | 3;

// ── Step 1 data ────────────────────────────────────────
const businessTypes = [
  "Agencja marketingowa / PR",
  "E-commerce / sklep online",
  "Marka / firma produktowa",
  "Freelancer / twórca treści",
  "Restauracja / gastronomia",
  "Usługi lokalne / stacjonarne",
  "Organizacja non-profit",
  "Inne",
];

const challenges = [
  { id: "comments", label: "Zarządzanie komentarzami i społecznością" },
  { id: "publishing", label: "Planowanie i publikacja treści" },
  { id: "analytics", label: "Analiza i raportowanie działań" },
  { id: "seo", label: "SEO i pozycjonowanie bloga" },
  { id: "competitors", label: "Monitorowanie konkurencji" },
  { id: "team", label: "Współpraca w zespole" },
];

// ── Step 2 data ────────────────────────────────────────
type Platform = {
  id: string;
  name: string;
  icon: ReactElement;
  color: string;
  badge?: string;
  category: "social" | "blog" | "ads" | "other";
};

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="#1877F2">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  );
}
function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7">
      <defs>
        <linearGradient id="ig" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f09433" />
          <stop offset="25%" stopColor="#e6683c" />
          <stop offset="50%" stopColor="#dc2743" />
          <stop offset="75%" stopColor="#cc2366" />
          <stop offset="100%" stopColor="#bc1888" />
        </linearGradient>
      </defs>
      <path fill="url(#ig)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}
function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="#0A66C2">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}
function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="black">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34v-7a8.16 8.16 0 004.77 1.52V6.4a4.85 4.85 0 01-1-.29z" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="black">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.738l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="#FF0000">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}
function WordPressIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="#21759B">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zM1.139 12c0-1.605.343-3.13.955-4.507l5.26 14.415A10.874 10.874 0 011.14 12zm10.861 10.861a10.879 10.879 0 01-3.081-.442l3.271-9.501 3.35 9.178a.956.956 0 00.072.14 10.884 10.884 0 01-3.612.625zm1.502-16.018c.655-.034 1.245-.103 1.245-.103.586-.069.517-.931-.069-.9 0 0-1.762.138-2.9.138-1.07 0-2.866-.138-2.866-.138-.587-.031-.656.865-.069.9 0 0 .555.069 1.141.103l1.693 4.637-2.378 7.13-3.955-11.767c.655-.034 1.245-.103 1.245-.103.586-.069.517-.931-.069-.9 0 0-1.762.138-2.9.138a10.97 10.97 0 00-.498.009C4.508 3.648 8.05 1.139 12 1.139c2.88 0 5.506 1.1 7.473 2.9a4.643 4.643 0 00-.284-.009c-1.07 0-1.83.931-1.83 1.93 0 .9.517 1.658 1.071 2.554.414.723.9 1.658.9 3.003 0 .931-.358 2.003-.827 3.52l-1.085 3.624-3.916-11.618zm5.282 14.57l3.329-9.624c.621-1.555.828-2.8.828-3.902 0-.4-.026-.772-.074-1.122a10.884 10.884 0 012.994 7.235c0 3.304-1.469 6.266-3.793 8.275l.007-.021-.032.004a10.87 10.87 0 01-3.259 8.275z" />
    </svg>
  );
}
function ShopifyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="#96BF48">
      <path d="M15.337.505a.496.496 0 00-.45-.41c-.185-.013-4.073-.075-4.073-.075s-2.7-2.637-2.998-2.935V24l8.072-1.999S17.5 2.282 17.5 2.19c0-.09-.066-.167-.156-.19l-2.007-.495zM10.814.02l-.883 2.757s-1.012-.47-2.24-.299c-1.781.24-1.854 1.558-1.847 1.903.06 2.952 7.32 3.604 7.724 10.542.315 5.455-2.881 9.2-7.516 9.484-5.567.343-8.627-2.943-8.627-2.943l1.178-5.012s3.083 2.33 5.549 2.136c1.607-.127 2.188-1.41 2.127-2.33-.08-3.043-6.05-2.862-6.416-9.211C.188 1.875 3.726-1.36 8.527.02a7.92 7.92 0 012.287 0z" />
    </svg>
  );
}
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7">
      <path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.615 24 12.255 24z" />
      <path fill="#FBBC05" d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 000 10.76l3.98-3.09z" />
      <path fill="#EA4335" d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.64 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
    </svg>
  );
}

const platforms: Platform[] = [
  { id: "facebook", name: "Strona na Facebooku", icon: <FacebookIcon />, color: "border-blue-200 hover:border-blue-400", category: "social" },
  { id: "instagram_biz", name: "Instagram Biznes", icon: <InstagramIcon />, color: "border-pink-200 hover:border-pink-400", category: "social" },
  { id: "instagram_ads", name: "Instagram Ads", icon: <InstagramIcon />, color: "border-pink-200 hover:border-pink-400", category: "ads" },
  { id: "x", name: "Profil X (Twitter)", icon: <XIcon />, color: "border-gray-200 hover:border-gray-500", category: "social", badge: "Tylko Publikacja" },
  { id: "linkedin", name: "Profil na LinkedIn", icon: <LinkedInIcon />, color: "border-blue-200 hover:border-blue-600", category: "social" },
  { id: "tiktok", name: "Profil TikTok", icon: <TikTokIcon />, color: "border-gray-200 hover:border-gray-500", category: "social" },
  { id: "youtube", name: "Kanał YouTube", icon: <YouTubeIcon />, color: "border-red-200 hover:border-red-500", category: "social" },
  { id: "google_biz", name: "Google Moja Firma", icon: <GoogleIcon />, color: "border-blue-100 hover:border-blue-400", category: "other" },
  { id: "wordpress", name: "WordPress (Blog)", icon: <WordPressIcon />, color: "border-sky-200 hover:border-sky-500", category: "blog" },
  { id: "shopify", name: "Shopify (Blog)", icon: <ShopifyIcon />, color: "border-green-200 hover:border-green-500", category: "blog" },
];

// ── Progress bar ────────────────────────────────────────
function ProgressBar({ step }: { step: Step }) {
  const steps = [
    { n: 1, label: "Ankieta" },
    { n: 2, label: "Podłącz profile" },
    { n: 3, label: "Zaproś zespół" },
  ];
  return (
    <div className="grid grid-cols-3">
      {steps.map((s, i) => {
        const done = step > s.n;
        const active = step === s.n;
        return (
          <div key={s.n} className="flex flex-col">
            <div
              className={`h-1 ${done ? "bg-[#5B7CFA]" : active ? "bg-[#5B7CFA]" : "bg-gray-200"}`}
            />
            <p className={`mt-3 text-sm font-medium ${active ? "text-[#5B7CFA]" : done ? "text-gray-400" : "text-gray-400"}`}>
              {done ? (
                <span className="mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#5B7CFA] text-[10px] text-white">✓</span>
              ) : null}
              Step {s.n}: {s.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ──────────────────────────────────────
export function OnboardingWizard() {
  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [businessType, setBusinessType] = useState("");
  const [challenge, setChallenge] = useState("");
  const [userType, setUserType] = useState<"team" | "solo" | "">("");

  // Step 2
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);

  // Step 3
  const [emails, setEmails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const togglePlatform = (id: string) => {
    setConnectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleFinish = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("https://content-control-tower-new.vercel.app/api/onboarding/complete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessType,
          challenge,
          userType,
          platforms: connectedPlatforms,
          teamEmails: emails,
        }),
      });
      if (!res.ok) {
        console.error("Onboarding API error:", res.status, await res.text());
      }
      window.location.href = "https://content-control-tower-new.vercel.app/overview";
    } catch (err) {
      console.error("Onboarding fetch failed:", err);
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Top nav */}
      <header className="border-b border-gray-100 px-8 py-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#5B7CFA]">
            <span className="text-sm font-bold text-white">S</span>
          </div>
          <span className="font-bold text-gray-900">Social AI Studio</span>
        </Link>
      </header>

      {/* Content */}
      <div className="flex flex-1 flex-col">
        {/* Progress */}
        <div className="border-b border-gray-100 px-8 py-6">
          <div className="mx-auto max-w-4xl">
            <ProgressBar step={step} />
          </div>
        </div>

        {/* Step content */}
        <div className="mx-auto w-full max-w-4xl flex-1 px-8 py-10">

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <div className="space-y-8">
              {/* Business type */}
              <div>
                <label className="mb-2 block font-semibold text-gray-900">
                  Twoja firma to:
                </label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  aria-label="Rodzaj działalności"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 outline-none transition focus:border-[#5B7CFA] focus:ring-2 focus:ring-[#5B7CFA]/20"
                >
                  <option value="">Wybierz rodzaj działalności</option>
                  {businessTypes.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              {/* Challenge */}
              <div>
                <p className="mb-3 font-semibold text-gray-900">
                  Co jest Twoim <span className="uppercase">największym</span> wyzwaniem:
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {challenges.map((c) => (
                    <label
                      key={c.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 transition ${
                        challenge === c.id
                          ? "border-[#5B7CFA] bg-[#EEF2FF]"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="challenge"
                        value={c.id}
                        checked={challenge === c.id}
                        onChange={() => setChallenge(c.id)}
                        className="accent-[#5B7CFA]"
                      />
                      <span className="text-sm text-gray-700">{c.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Who */}
              <div>
                <p className="mb-3 font-semibold text-gray-900">
                  Kto będzie korzystał z Social AI Studio:
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { id: "team", label: "Zespół", icon: "👥" },
                    { id: "solo", label: "Tylko ja", icon: "🙋" },
                  ].map((u) => (
                    <label
                      key={u.id}
                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-5 py-4 transition ${
                        userType === u.id
                          ? "border-[#5B7CFA] bg-[#EEF2FF]"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="userType"
                          value={u.id}
                          checked={userType === u.id}
                          onChange={() => setUserType(u.id as "team" | "solo")}
                          className="accent-[#5B7CFA]"
                        />
                        <span className="font-medium text-gray-800">{u.label}</span>
                      </div>
                      <span className="text-2xl">{u.icon}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Podłącz profile zarządzane</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Dodaj przynajmniej jeden profil, żeby w pełni odblokować możliwości Social AI Studio.
                  </p>
                </div>
                <div className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-500">
                  Podłączono{" "}
                  <span className="font-bold text-[#5B7CFA]">{connectedPlatforms.length}</span>
                  /10 profili
                </div>
              </div>

              {/* Categories */}
              {[
                { label: "📱 Social Media", cat: "social" as const },
                { label: "📝 Blogi i sklepy", cat: "blog" as const },
                { label: "📣 Reklamy", cat: "ads" as const },
                { label: "🗺️ Inne", cat: "other" as const },
              ].map(({ label, cat }) => {
                const items = platforms.filter((p) => p.category === cat);
                if (!items.length) return null;
                return (
                  <div key={cat} className="mt-6">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                      {items.map((p) => {
                        const connected = connectedPlatforms.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => togglePlatform(p.id)}
                            className={`relative flex items-center justify-between rounded-xl border-2 px-4 py-4 text-left transition ${
                              connected
                                ? "border-[#5B7CFA] bg-[#EEF2FF]"
                                : `border-gray-200 bg-white ${p.color}`
                            }`}
                          >
                            <span className={`text-sm font-medium ${connected ? "text-[#5B7CFA]" : "text-gray-700"}`}>
                              {p.name}
                            </span>
                            <span className="ml-2 flex-shrink-0">{p.icon}</span>
                            {p.badge && !connected && (
                              <span className="absolute bottom-0 left-0 right-0 rounded-b-xl bg-gray-700 py-0.5 text-center text-[10px] font-medium text-white">
                                {p.badge}
                              </span>
                            )}
                            {connected && (
                              <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#5B7CFA] text-[10px] text-white shadow">
                                ✓
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <p className="mt-6 text-xs text-gray-400">
                * Podłączenie kont przez OAuth — bezpieczne i szyfrowane. Możesz odłączyć w każdej chwili w Ustawieniach.
              </p>
            </div>
          )}

          {/* ── STEP 3 ── */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Zaproś swój zespół{" "}
                  <span className="text-sm font-normal text-gray-400">(opcjonalnie)</span>
                </h2>

                <div className="mt-4 rounded-xl border border-[#5B7CFA]/30 bg-[#EEF2FF] px-5 py-4 text-sm text-[#3B5BD6]">
                  💡 Zaproś do 4 członków zespołu podczas okresu próbnego.
                  Po wybraniu planu możesz zapraszać dowolną liczbę osób — bez ograniczeń.
                </div>
              </div>

              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">@</span>
                <input
                  type="text"
                  value={emails}
                  onChange={(e) => setEmails(e.target.value)}
                  placeholder="Podaj adresy e-mail, wpisując między nimi przecinek lub spację"
                  className="w-full rounded-xl border border-gray-200 py-4 pl-9 pr-4 text-sm text-gray-700 outline-none transition focus:border-[#5B7CFA] focus:ring-2 focus:ring-[#5B7CFA]/20"
                />
              </div>

              <p className="text-sm text-gray-400">
                Zaproszeni otrzymają e-mail z linkiem aktywacyjnym.
              </p>
            </div>
          )}
        </div>

        {/* Bottom nav */}
        <div className="border-t border-gray-100 px-8 py-5">
          <div className="mx-auto flex max-w-4xl items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as Step)}
                className="text-sm font-medium text-[#5B7CFA] hover:underline"
              >
                ← Poprzedni krok
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s + 1) as Step)}
                className="rounded-xl bg-yellow-400 px-8 py-3 text-sm font-bold text-gray-900 transition hover:bg-yellow-300 active:scale-[0.98]"
              >
                Następny krok →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                disabled={submitting}
                className="rounded-xl bg-[#5B7CFA] px-8 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {submitting ? "Ładowanie..." : "Zacznij korzystać z Social AI Studio →"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
