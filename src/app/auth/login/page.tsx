import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/LoginForm";
import Link from "next/link";

const PROD = "content-control-tower-new.vercel.app";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; success?: string; next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "";
  if (host && host !== PROD) {
    redirect(`https://${PROD}/auth/login`);
  }

  const params = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-4 py-12">
      {/* Logo */}
      <Link href="/" className="mb-8 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#5B7CFA]">
          <span className="text-sm font-bold text-white">S</span>
        </div>
        <span className="font-bold text-gray-900">Social AI Studio</span>
      </Link>

      <div className="w-full max-w-md">
        <h1 className="mb-6 text-center text-3xl font-bold text-gray-900">Zaloguj</h1>
        <LoginForm
          error={params.error}
          success={params.success}
          next={params.next}
        />
      </div>
    </main>
  );
}
