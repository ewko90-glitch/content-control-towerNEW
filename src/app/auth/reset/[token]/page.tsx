import { AuthLayout } from "@/components/layout/AuthLayout";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type ResetTokenPageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function ResetTokenPage({ params, searchParams }: ResetTokenPageProps) {
  const routeParams = await params;
  const query = await searchParams;

  return (
    <AuthLayout title="Ustaw nowe hasło" description="Wprowadź nowe hasło do swojego konta.">
      {query.error ? <Alert variant="danger">{query.error}</Alert> : null}

      <form action="/api/auth/reset/confirm" method="post" className="mt-4 space-y-4">
        <input type="hidden" name="token" value={routeParams.token} />
        <Input
          name="password"
          type="password"
          minLength={10}
          required
          label="Nowe hasło"
          hint="Hasło musi mieć co najmniej 10 znaków."
        />
        <Button type="submit" className="w-full">
          Zapisz nowe hasło
        </Button>
      </form>
    </AuthLayout>
  );
}
