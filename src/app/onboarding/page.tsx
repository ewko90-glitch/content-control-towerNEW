import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dropdown } from "@/components/ui/Dropdown";
import { Input } from "@/components/ui/Input";
import { prisma } from "../../lib/prisma";
import { requireUser } from "../../lib/auth/session";

export default async function OnboardingPage() {
  const user = await requireUser();

  const memberships = await prisma.workspaceMembership.findMany({
    where: { userId: user.id },
    select: { id: true },
    take: 1,
  });

  if (memberships.length > 0) {
    redirect("/overview");
  }

  return (
    <AppShell title="Onboarding" subtitle="Skonfiguruj swoje środowisko" activeHref="/onboarding">
      <PageHeader title="Pierwsza konfiguracja" subtitle="Cztery krótkie kroki i możesz działać." />

      <Card>
        <CardHeader>
          <CardTitle>Konfiguracja workspace</CardTitle>
        </CardHeader>
        <CardContent>
          <form action="/api/onboarding/complete" method="post" className="space-y-5">
            <Input name="workspaceName" required label="Krok 1: Nazwa Twojej organizacji" />

            <Dropdown
              name="planTier"
              defaultValue="STARTER"
              label="Krok 2: Wybierz plan"
              options={[
                { value: "STARTER", label: "STARTER" },
                { value: "PRO", label: "PRO" },
                { value: "CONTROL", label: "CONTROL" },
              ]}
            />

            <Input name="projectName" required label="Krok 3: Utwórz pierwszy projekt" />

            <fieldset className="rounded-xl border border-border bg-surface2 p-3">
              <legend className="px-2 text-sm font-medium text-text">Krok 4: Wybierz kanały komunikacji</legend>
              <div className="mt-2 space-y-1">
                <Checkbox name="channels" value="BLOG" defaultChecked label="Blog" />
                <Checkbox name="channels" value="LINKEDIN" defaultChecked label="LinkedIn" />
                <Checkbox name="channels" value="TIKTOK" label="TikTok" />
              </div>
            </fieldset>

            <Button type="submit" className="w-full sm:w-auto">
              Zakończ onboarding
            </Button>
          </form>
        </CardContent>
      </Card>
    </AppShell>
  );
}
