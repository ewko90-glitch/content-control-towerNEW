import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

type AuthLayoutProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function AuthLayout({ title, description, children }: AuthLayoutProps) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-primarySoft via-bg to-secondarySoft px-4 py-12">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-md flex-col items-center justify-center gap-6">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Content Control Tower</p>
        </div>

        <Card className="w-full">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>

        <p className="text-xs text-muted">© Content Control Tower</p>
      </div>
    </main>
  );
}
