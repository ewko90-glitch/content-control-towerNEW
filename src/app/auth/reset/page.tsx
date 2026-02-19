import Link from "next/link";

type ResetRequestPageProps = {
  searchParams: Promise<{ success?: string }>;
};

export default async function ResetRequestPage({ searchParams }: ResetRequestPageProps) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#5B7CFA]">
          <span className="text-sm font-bold text-white">S</span>
        </div>
        <span className="font-bold text-gray-900">Social AI Studio</span>
      </Link>

      <div className="w-full max-w-md">
        <h1 className="mb-2 text-center text-3xl font-bold text-gray-900">Reset hasła</h1>
        <p className="mb-6 text-center text-sm text-gray-500">
          Wyślemy Ci link do zresetowania hasła.
        </p>

        {params.success && (
          <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {params.success}
          </div>
        )}

        <form action="/api/auth/reset/request" method="post" className="space-y-3">
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

          <button
            type="submit"
            className="w-full rounded-xl bg-yellow-400 py-4 text-base font-bold text-gray-900 transition hover:bg-yellow-300"
          >
            Wyślij link resetujący
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          <Link href="/auth/login" className="text-[#5B7CFA] hover:underline">
            Wróć do logowania
          </Link>
        </p>
      </div>
    </main>
  );
}
