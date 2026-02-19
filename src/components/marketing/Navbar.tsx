"use client";

import Link from "next/link";
import { useState } from "react";

const navLinks = [
  { label: "Funkcje", href: "#funkcje" },
  { label: "SEO i Blog", href: "#seo" },
  { label: "Platformy", href: "#platformy" },
  { label: "Cennik", href: "#cennik" },
  { label: "Blog", href: "/blog" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#5B7CFA]">
            <span className="text-sm font-bold text-white">S</span>
          </div>
          <span className="text-lg font-bold text-gray-900">Social AI Studio</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* CTA buttons */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/auth/login"
            className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
          >
            Zaloguj się
          </Link>
          <Link
            href="/auth/register"
            className="rounded-lg bg-[#5B7CFA] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Wypróbuj za darmo
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="flex flex-col gap-1.5 md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
        >
          <span className={`h-0.5 w-6 bg-gray-700 transition-all ${open ? "translate-y-2 rotate-45" : ""}`} />
          <span className={`h-0.5 w-6 bg-gray-700 transition-all ${open ? "opacity-0" : ""}`} />
          <span className={`h-0.5 w-6 bg-gray-700 transition-all ${open ? "-translate-y-2 -rotate-45" : ""}`} />
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-gray-100 bg-white px-6 pb-4 md:hidden">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="block py-3 text-sm font-medium text-gray-700"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <div className="mt-3 flex flex-col gap-2">
            <Link href="/auth/login" className="text-center text-sm font-medium text-gray-600">
              Zaloguj się
            </Link>
            <Link
              href="/auth/register"
              className="rounded-lg bg-[#5B7CFA] px-4 py-2.5 text-center text-sm font-semibold text-white"
            >
              Wypróbuj za darmo
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
