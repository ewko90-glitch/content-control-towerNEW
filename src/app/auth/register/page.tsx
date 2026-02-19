import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { RegisterForm } from "@/components/auth/RegisterForm";

const PROD = "content-control-tower-new.vercel.app";

type RegisterPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "";
  if (host && host !== PROD) {
    redirect(`https://${PROD}/auth/register`);
  }

  const params = await searchParams;

  return (
    <main className="min-h-screen bg-white">
      <RegisterForm error={params.error} />
    </main>
  );
}
