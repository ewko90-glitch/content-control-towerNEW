"use client";

import Link from "next/link";
import { useState } from "react";

type RegisterFormProps = {
  error?: string;
};

function FacebookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.615 24 12.255 24z" />
      <path fill="#FBBC05" d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 000 10.76l3.98-3.09z" />
      <path fill="#EA4335" d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.64 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
    </svg>
  );
}

const reviews = [
  { platform: "GetApp", score: "4.6/5" },
  { platform: "Capterra", score: "4.6/5" },
  { platform: "G2", score: "4.7/5" },
  { platform: "Software Advice", score: "4.6/5" },
];

export function RegisterForm({ error }: RegisterFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [newsletter, setNewsletter] = useState(false);

  return (
    <div className="min-h-screen md:grid md:grid-cols-2">
      {/* ── Left: form ── */}
      <div className="flex flex-col justify-center px-8 py-14 md:px-12 lg:px-20">
        {/* Logo */}
        <Link href="/" className="mb-10 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#5B7CFA]">
            <span className="text-sm font-bold text-white">S</span>
          </div>
          <span className="font-bold text-gray-900">Social AI Studio</span>
        </Link>

        <h1 className="text-3xl font-bold text-gray-900">Załóż swoje konto</h1>
        <p className="mt-2 text-sm text-gray-500">
          14 dni pełnego dostępu.{" "}
          <strong className="text-gray-900">Dołącz do 12 000+ marketerów i agencji.</strong>
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form action="/api/auth/register" method="post" className="mt-6 space-y-3">
          {/* Email */}
          <div className="relative">
            <label className="absolute left-4 top-2.5 text-[11px] font-medium text-gray-400">
              Firmowy e-mail
            </label>
            <input
              name="email"
              type="email"
              required
              placeholder="imie@email.com"
              className="w-full rounded-xl border border-gray-300 pb-3 pl-4 pr-4 pt-7 text-sm text-gray-900 outline-none transition focus:border-[#5B7CFA] focus:ring-2 focus:ring-[#5B7CFA]/20"
            />
          </div>

          {/* Password */}
          <div className="relative">
            <label className="absolute left-4 top-2.5 text-[11px] font-medium text-gray-400">
              Hasło
            </label>
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={10}
              placeholder="••••••••"
              className="w-full rounded-xl border border-gray-300 pb-3 pl-4 pr-16 pt-7 text-sm text-gray-900 outline-none transition focus:border-[#5B7CFA] focus:ring-2 focus:ring-[#5B7CFA]/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#5B7CFA]"
            >
              {showPassword ? "Ukryj" : "Pokaż"}
            </button>
          </div>

          {/* Newsletter */}
          <label className="flex cursor-pointer items-start gap-3 pt-1">
            <input
              type="checkbox"
              name="newsletter"
              checked={newsletter}
              onChange={(e) => setNewsletter(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded accent-[#5B7CFA]"
            />
            <span className="text-xs leading-relaxed text-gray-500">
              Chcę otrzymywać comiesięczny newsletter z updateami produktu,
              bezpłatnymi e-bookami i najnowszymi trendami w social media.
            </span>
          </label>

          <button
            type="submit"
            className="w-full rounded-xl bg-yellow-400 py-4 text-base font-bold text-gray-900 transition hover:bg-yellow-300 active:scale-[0.98]"
          >
            Załóż konto
          </button>
        </form>

        {/* Divider */}
        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-sm text-gray-400">lub</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        {/* OAuth */}
        <a
          href="/api/auth/facebook"
          className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-[#1877F2] py-3.5 text-sm font-semibold text-[#1877F2] transition hover:bg-blue-50"
        >
          <FacebookIcon />
          Załóż konto przez Facebooka
        </a>
        <a
          href="/api/auth/google"
          className="mt-3 flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 py-3.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
        >
          <GoogleIcon />
          Załóż konto przez Google
        </a>

        <p className="mt-6 text-center text-xs text-gray-400">
          Dołączając, akceptujesz nasz{" "}
          <Link href="/regulamin" className="text-[#5B7CFA] hover:underline">
            regulamin
          </Link>{" "}
          i{" "}
          <Link href="/polityka-prywatnosci" className="text-[#5B7CFA] hover:underline">
            politykę prywatności
          </Link>
          .
        </p>
        <p className="mt-2 text-center text-sm text-gray-500">
          Masz już konto?{" "}
          <Link href="/auth/login" className="text-[#5B7CFA] hover:underline">
            Zaloguj się
          </Link>
        </p>
      </div>

      {/* ── Right: social proof ── */}
      <div className="hidden flex-col items-center justify-center bg-gray-50 px-12 py-14 md:flex">
        <h2 className="text-3xl font-bold text-gray-900">
          <span className="text-[#5B7CFA]">Dokonujesz</span> słusznego wyboru.
        </h2>

        {/* Testimonial */}
        <div className="mt-10 max-w-sm text-center">
          <div className="mx-auto mb-5 h-20 w-20 overflow-hidden rounded-full bg-gray-300 ring-4 ring-white shadow-lg">
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#5B7CFA] to-purple-500 text-2xl font-bold text-white">
              A
            </div>
          </div>
          <p className="text-base leading-relaxed text-gray-700">
            "Wybraliśmy tę platformę zarówno ze względu na funkcjonalności samego narzędzia, jak i podejście do współpracy. Od początku poczuliśmy się zaopiekowani, a narzędzie dopasowano do naszych potrzeb."
          </p>
          <p className="mt-4 text-sm font-medium text-gray-400">
            Marketing Manager
          </p>
          <p className="mt-1 text-lg font-bold tracking-widest text-gray-900">
            AVON
          </p>
        </div>

        {/* Rating badges */}
        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
          {reviews.map((r) => (
            <div key={r.platform} className="flex flex-col items-center gap-1">
              <p className="text-xs font-semibold text-gray-500">{r.platform}</p>
              <div className="flex gap-0.5 text-yellow-400">
                {"★★★★★".split("").map((s, i) => (
                  <span key={i}>{s}</span>
                ))}
              </div>
              <p className="text-xs font-bold text-gray-700">{r.score}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
