import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { Input } from "@/components/ui/Input";
import { Progress } from "@/components/ui/Progress";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { uiCopy } from "@/lib/uiCopy";
import { cn } from "@/styles/cn";

type NavItem = {
  label: string;
  href: (workspaceSlug?: string) => string;
  visibleFor?: "all" | "employee" | "coo";
};

type AppShellProps = {
  title: string;
  subtitle?: string;
  activeHref?: string;
  workspaceSlug?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
};

const navItems: NavItem[] = [
  { label: uiCopy.pl.nav.calendar, href: (slug) => (slug ? `/w/${slug}/calendar` : "/overview"), visibleFor: "employee" },
  { label: uiCopy.pl.nav.writeNow, href: (slug) => (slug ? `/w/${slug}/content` : "/overview"), visibleFor: "employee" },
  { label: uiCopy.pl.nav.projects, href: (slug) => (slug ? `/w/${slug}/projects` : "/overview"), visibleFor: "employee" },
  { label: uiCopy.pl.nav.stats, href: (slug) => (slug ? `/w/${slug}/portfolio` : "/overview"), visibleFor: "employee" },
  { label: uiCopy.pl.nav.settings, href: (slug) => (slug ? `/w/${slug}/settings/project` : "/account"), visibleFor: "employee" },

  { label: uiCopy.pl.nav.calendar, href: (slug) => (slug ? `/w/${slug}/calendar` : "/overview"), visibleFor: "coo" },
  { label: uiCopy.pl.nav.writeNow, href: (slug) => (slug ? `/w/${slug}/content` : "/overview"), visibleFor: "coo" },
  { label: uiCopy.pl.nav.projects, href: (slug) => (slug ? `/w/${slug}/projects` : "/overview"), visibleFor: "coo" },
  { label: uiCopy.pl.nav.stats, href: (slug) => (slug ? `/w/${slug}/portfolio` : "/overview"), visibleFor: "coo" },
  { label: uiCopy.pl.nav.settings, href: (slug) => (slug ? `/w/${slug}/settings/project` : "/account"), visibleFor: "coo" },
];

function resolvePersona(role: "ADMIN" | "MANAGER" | "EDITOR" | "VIEWER" | undefined): "employee" | "coo" {
  if (role === "ADMIN" || role === "MANAGER") {
    return "coo";
  }
  return "employee";
}

export async function AppShell({ title, subtitle, activeHref = "/overview", workspaceSlug, children, actions }: AppShellProps) {
  const user = await getCurrentUser();

  const memberships = user
    ? await prisma.workspaceMembership.findMany({
        where: {
          userId: user.id,
          workspace: { deletedAt: null },
        },
        include: {
          workspace: {
            include: {
              aiCreditAccount: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const activeWorkspace =
    memberships.find((membership) => membership.workspace.slug === workspaceSlug) ?? memberships[0] ?? null;
  const persona = resolvePersona(activeWorkspace?.role);

  const filteredNavItems = navItems.filter((item) => {
    const visibleFor = item.visibleFor ?? "all";
    return visibleFor === "all" || visibleFor === persona;
  });

  const creditsMonthly = activeWorkspace?.workspace.aiCreditAccount?.creditsMonthly ?? 0;
  const creditsUsed = activeWorkspace?.workspace.aiCreditAccount?.creditsUsed ?? 0;
  const creditsLeft = Math.max(creditsMonthly - creditsUsed, 0);

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="mx-auto grid min-h-screen max-w-app grid-cols-1 lg:grid-cols-[17.5rem_minmax(0,1fr)]">
        <aside className="border-r border-border bg-surface/80 px-4 py-6 lg:px-5">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Content Control Tower</p>
          </div>

          <form action="/overview" method="get" className="mb-6">
            <Dropdown
              name="workspace"
              label="Przestrzeń robocza"
              defaultValue={activeWorkspace?.workspace.slug}
              options={
                memberships.length > 0
                  ? memberships.map((membership) => ({
                      value: membership.workspace.slug,
                      label: membership.workspace.name,
                    }))
                    : [{ value: "", label: "Brak przestrzeni roboczej" }]
              }
              disabled={memberships.length === 0}
            />
            <Button type="submit" variant="ghost" size="sm" className="mt-2 w-full">
              Przełącz
            </Button>
          </form>

          <nav className="space-y-1">
            {filteredNavItems.map((item) => {
              const href = item.href(activeWorkspace?.workspace.slug);
              const isActive = activeHref === href;
              return (
                <Link
                  key={item.label}
                  href={href}
                  className={cn(
                    "block rounded-xl px-3 py-2 text-sm transition-colors duration-fast ease-base",
                    isActive ? "bg-primarySoft text-primary" : "text-muted hover:bg-surface2 hover:text-text",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur">
            <div className="flex h-topbar items-center justify-between gap-4 px-4 lg:px-8">
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-text">{title}</p>
                {subtitle ? <p className="truncate text-xs text-muted">{subtitle}</p> : null}
              </div>

              <div className="flex items-center gap-3">
                {activeWorkspace ? (
                  <div className="hidden min-w-[220px] rounded-xl border border-border bg-surface2 px-3 py-2 md:block">
                    <div className="mb-1 flex items-center justify-between text-xs text-muted">
                      <span>Kredyty AI</span>
                      <Badge variant="credits">{creditsLeft} / {creditsMonthly}</Badge>
                    </div>
                    <Progress value={creditsUsed} max={creditsMonthly || 1} />
                  </div>
                ) : null}

                <div className="hidden w-56 md:block">
                  <Input aria-label="Szukaj" placeholder="Szukaj (wkrótce)" disabled />
                </div>

                <div className="rounded-xl border border-border bg-surface2 px-3 py-2 text-sm">
                  <p className="font-medium text-text">{user?.name ?? user?.email ?? "Użytkownik"}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Link href="/account" className="text-xs text-primary hover:underline">
                      Moje konto
                    </Link>
                    <span className="text-xs text-muted">•</span>
                    <form action="/api/auth/logout" method="post">
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" type="submit">
                        Wyloguj
                      </Button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <main className="w-full px-4 py-6 lg:px-8">
            <div className="mx-auto max-w-5xl">{children}</div>
            {actions ? <div className="mx-auto mt-4 max-w-5xl">{actions}</div> : null}
          </main>
        </div>
      </div>
    </div>
  );
}
