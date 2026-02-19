import { AuthLayout } from "@/components/layout/AuthLayout";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; success?: string; next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <AuthLayout title="Logowanie" description="Witaj ponownie. Zaloguj się, aby kontynuować.">
      <form action="/api/auth/login" method="post" className="space-y-4">
        {params.error ? <Alert variant="danger">{params.error || "Nieprawidłowy email lub hasło."}</Alert> : null}
        {params.success ? <Alert variant="success">{params.success}</Alert> : null}

        <input type="hidden" name="next" value={params.next ?? ""} />

        <Input name="email" type="email" required label="Email" hint="Wpisz poprawny adres email." />
        <Input name="password" type="password" required label="Hasło" />

        <Button type="submit" className="w-full">
          Zaloguj się
        </Button>
      </form>
      <p className="mt-4 text-sm text-muted">
        <a href="/auth/reset">Nie pamiętasz hasła?</a>
      </p>
      <p className="mt-2 text-sm text-muted">
        Nie masz konta? <a href="/auth/register">Zarejestruj się</a>
      </p>
    </AuthLayout>
  );
}
