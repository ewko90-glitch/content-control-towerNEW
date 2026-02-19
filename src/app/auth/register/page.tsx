import { AuthLayout } from "@/components/layout/AuthLayout";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type RegisterPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;

  return (
    <AuthLayout title="Rejestracja" description="Utwórz konto i zacznij pracę z Content Control Tower.">
      <form action="/api/auth/register" method="post" className="space-y-4">
        {params.error ? <Alert variant="danger">{params.error}</Alert> : null}

        <Input name="email" type="email" required label="Email" hint="Wpisz poprawny adres email." />
        <Input
          name="password"
          type="password"
          minLength={10}
          required
          label="Hasło"
          hint="Hasło musi mieć co najmniej 10 znaków."
        />
        <Input name="name" type="text" label="Imię (opcjonalnie)" />

        <Button type="submit" className="w-full">
          Załóż konto
        </Button>
      </form>
      <p className="mt-4 text-sm text-muted">
        Masz już konto? <a href="/auth/login">Zaloguj się</a>
      </p>
    </AuthLayout>
  );
}
