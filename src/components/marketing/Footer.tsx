import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-[#E2E8F0] bg-[#F6F8FB] py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 md:flex-row md:items-center">
        <p className="text-sm text-[#94A3B8]">© 2026 Content Control Tower. Zrobione w Polsce.</p>

        <nav className="flex flex-wrap gap-5 text-sm text-[#475569]">
          <Link href="/login" className="hover:text-[#0F172A]">Zaloguj się</Link>
          <a href="#cennik" className="hover:text-[#0F172A]">Cennik</a>
          <Link href="/regulamin" className="hover:text-[#0F172A]">Regulamin</Link>
          <Link href="/polityka-prywatnosci" className="hover:text-[#0F172A]">Polityka prywatności</Link>
        </nav>
      </div>
    </footer>
  );
}