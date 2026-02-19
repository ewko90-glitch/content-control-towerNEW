import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { requireUser } from "../../lib/auth/session";
import { prisma } from "../../lib/prisma";

export default async function AccountPage() {
  const user = await requireUser();

  const memberships = await prisma.workspaceMembership.findMany({
    where: { userId: user.id },
    include: {
      workspace: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const recentAudit = await prisma.auditLog.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const currentPersona = memberships.some((membership) => membership.role === "ADMIN" || membership.role === "MANAGER")
    ? "COO"
    : "EMPLOYEE";
  const defaultWorkspaceSlug = memberships[0]?.workspace.slug ?? "";
  const isDev = process.env.NODE_ENV === "development";

  return (
    <AppShell title="Moje konto" subtitle="Profil i aktywność" activeHref="/account">
      <PageHeader title="Konto" subtitle="Zarządzaj profilem i monitoruj aktywność." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dane użytkownika</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted">Email:</span> {user.email}
            </p>
            <p>
              <span className="text-muted">Imię:</span> {user.name ?? "—"}
            </p>
            <p>
              <span className="text-muted">Persona:</span> <Badge variant="role">{currentPersona}</Badge>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workspace i role</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {memberships.map((membership: (typeof memberships)[number]) => (
                <li key={membership.id} className="flex items-center justify-between rounded-xl bg-surface2 px-3 py-2">
                  <span>{membership.workspace.name}</span>
                  <Badge variant="role">{membership.role}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Ostatnie 20 działań</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {recentAudit.map((entry: (typeof recentAudit)[number]) => (
              <li key={entry.id} className="rounded-xl bg-surface2 px-3 py-2">
                <span className="font-medium">{entry.action}</span>
                <span className="ml-2 text-muted">{entry.createdAt.toISOString()}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {isDev ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Dev Switch User</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <form action="/api/auth/login" method="post">
              <input type="hidden" name="email" value="employee@local.test" />
              <input type="hidden" name="password" value="LocalDemo123!" />
              <input type="hidden" name="next" value={defaultWorkspaceSlug ? `/w/${defaultWorkspaceSlug}/content` : "/account"} />
              <Button type="submit" variant="secondary" size="sm">Switch to Employee</Button>
            </form>
            <form action="/api/auth/login" method="post">
              <input type="hidden" name="email" value="coo@local.test" />
              <input type="hidden" name="password" value="LocalDemo123!" />
              <input type="hidden" name="next" value={defaultWorkspaceSlug ? `/w/${defaultWorkspaceSlug}/portfolio/execution-health` : "/account"} />
              <Button type="submit" variant="ghost" size="sm">Switch to COO</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </AppShell>
  );
}
