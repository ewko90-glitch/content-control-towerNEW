import { AuthLayout } from "@/components/layout/AuthLayout";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type ResetRequestPageProps = {
  searchParams: Promise<{ success?: string }>;
};

export default async function ResetRequestPage({ searchParams }: ResetRequestPageProps) {
  const params = await searchParams;

  return (
    <AuthLayout title="Reset hasła" description="Otrzymasz instrukcję resetu, jeśli konto istnieje.">
      {params.success ? <Alert variant="success">{params.success}</Alert> : null}

      <form action="/api/auth/reset/request" method="post" className="mt-4 space-y-4">
        <Input
          name="email"
          type="email"
          required
          label="Email"
          hint="Jeśli konto istnieje, wyślemy instrukcję resetu hasła."
        />
        <Button type="submit" className="w-full">
          Wyślij instrukcję resetu
        </Button>
      </form>

      <p className="mt-4 text-sm text-muted">
        <a href="/auth/login">Wróć do logowania</a>
      </p>
    </AuthLayout>
  );
}
