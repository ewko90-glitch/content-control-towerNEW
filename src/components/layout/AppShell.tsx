import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { TrialBanner } from "@/components/ui/TrialBanner";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { cn } from "@/styles/cn";

type NavItem = {
  label: string;
  href: (workspaceSlug?: string) => string;
  icon: React.ReactNode;
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

// ── Icons ─────────────────────────────────────────────
function IconOverview() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M10.707 2.293a1 1 0 0 0-1.414 0l-7 7a1 1 0 0 0 1.414 1.414L4 10.414V17a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-3h2v3a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-6.586l.293.293a1 1 0 0 0 1.414-1.414l-7-7z" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M6 2a1 1 0 0 0-1 1v1H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1V3a1 1 0 1 0-2 0v1H7V3a1 1 0 0 0-1-1zm0 5a1 1 0 0 0 0 2h8a1 1 0 1 0 0-2H6z" clipRule="evenodd" />
    </svg>
  );
}
function IconPen() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-.793.793-2.828-2.828.793-.793zm-2.207 2.207L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
    </svg>
  );
}
function IconFolder() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M2 6a2 2 0 0 1 2-2h5l2 2h5a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M2 11a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-5zm6-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V7zm6-3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V4z" />
    </svg>
  );
}
function IconSettings() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 0 1-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 0 1 .947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 0 1 2.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 0 1 2.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 0 1 .947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 0 1-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 0 1-2.287-.947zM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" clipRule="evenodd" />
    </svg>
  );
}
function IconPlay() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM9.555 7.168A1 1 0 0 0 8 8v4a1 1 0 0 0 1.555.832l3-2a1 1 0 0 0 0-1.664l-3-2z" clipRule="evenodd" />
    </svg>
  );
}
function IconRocket() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M10.894 2.553a1 1 0 0 0-1.788 0l-7 14a1 1 0 0 0 1.169 1.409l5-1.429A1 1 0 0 0 9 15.571V11a1 1 0 1 1 2 0v4.571a1 1 0 0 0 .725.962l5 1.428a1 1 0 0 0 1.17-1.408l-7-14z" />
    </svg>
  );
}

// ── Nav items ──────────────────────────────────────────
const navItems: NavItem[] = [
  { label: "Przegląd", href: () => "/overview", icon: <IconOverview />, visibleFor: "all" },
  { label: "Kalendarz", href: (s) => (s ? `/w/${s}/calendar` : "/overview"), icon: <IconCalendar />, visibleFor: "employee" },
  { label: "Pisz teraz", href: (s) => (s ? `/w/${s}/content` : "/overview"), icon: <IconPen />, visibleFor: "employee" },
  { label: "Projekty", href: (s) => (s ? `/w/${s}/projects` : "/overview"), icon: <IconFolder />, visibleFor: "employee" },
  { label: "Statystyki", href: (s) => (s ? `/w/${s}/portfolio` : "/overview"), icon: <IconChart />, visibleFor: "employee" },
  { label: "Ustawienia", href: (s) => (s ? `/w/${s}/settings/project` : "/account"), icon: <IconSettings />, visibleFor: "employee" },
  { label: "Przegląd", href: () => "/overview", icon: <IconOverview />, visibleFor: "coo" },
  { label: "Kalendarz", href: (s) => (s ? `/w/${s}/calendar` : "/overview"), icon: <IconCalendar />, visibleFor: "coo" },
  { label: "Pisz teraz", href: (s) => (s ? `/w/${s}/content` : "/overview"), icon: <IconPen />, visibleFor: "coo" },
  { label: "Projekty", href: (s) => (s ? `/w/${s}/projects` : "/overview"), icon: <IconFolder />, visibleFor: "coo" },
  { label: "Statystyki", href: (s) => (s ? `/w/${s}/portfolio` : "/overview"), icon: <IconChart />, visibleFor: "coo" },
  { label: "Ustawienia", href: (s) => (s ? `/w/${s}/settings/project` : "/account"), icon: <IconSettings />, visibleFor: "coo" },
];

function resolvePersona(role: "ADMIN" | "MANAGER" | "EDITOR" | "VIEWER" | undefined): "employee" | "coo" {
  return role === "ADMIN" || role === "MANAGER" ? "coo" : "employee";
}

export async function AppShell({
  title,
  subtitle,
  activeHref = "/overview",
  workspaceSlug,
  children,
  actions,
}: AppShellProps) {
  const user = await getCurrentUser();

  const memberships = user
    ? await prisma.workspaceMembership.findMany({
        where: { userId: user.id, workspace: { deletedAt: null } },
        include: { workspace: { include: { aiCreditAccount: true } } },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const activeWorkspace =
    memberships.find((m) => m.workspace.slug === workspaceSlug) ??
    memberships[0] ??
    null;
  const persona = resolvePersona(activeWorkspace?.role);

  const filteredNavItems = navItems.filter((item) => {
    const v = item.visibleFor ?? "all";
    return v === "all" || v === persona;
  });

  const creditsMonthly = activeWorkspace?.workspace.aiCreditAccount?.creditsMonthly ?? 0;
  const creditsUsed = activeWorkspace?.workspace.aiCreditAccount?.creditsUsed ?? 0;
  const creditsLeft = Math.max(creditsMonthly - creditsUsed, 0);

  return (
    <div className="min-h-screen bg-[#F4F6FB] text-[#1C2240]">
      <div className="mx-auto grid min-h-screen max-w-[1440px] grid-cols-1 lg:grid-cols-[15rem_minmax(0,1fr)]">

        {/* ── SIDEBAR ── */}
        <aside className="flex flex-col bg-[#0F172A] lg:min-h-screen">
          {/* Logo */}
          <div className="flex items-center gap-2.5 px-5 py-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#5B7CFA]">
              <span className="text-sm font-bold text-white">S</span>
            </div>
            <span className="font-bold text-white">Social AI Studio</span>
          </div>

          {/* Workspace badge */}
          {activeWorkspace && (
            <div className="mx-4 mb-4 rounded-xl bg-white/5 px-3 py-2.5">
              <p className="text-xs font-medium text-slate-400">Przestrzeń robocza</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-white">{activeWorkspace.workspace.name}</p>
              {memberships.length > 1 && (
                <a href="/overview" className="mt-1 text-[11px] text-slate-500 hover:text-slate-300">
                  Zmień →
                </a>
              )}
            </div>
          )}

          {/* Main nav */}
          <nav className="flex-1 space-y-0.5 px-3">
            {filteredNavItems.map((item) => {
              const href = item.href(activeWorkspace?.workspace.slug);
              const isActive = activeHref === href || (href !== "/overview" && activeHref.startsWith(href));
              return (
                <Link
                  key={`${item.label}-${href}`}
                  href={href}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                    isActive
                      ? "bg-[#5B7CFA] text-white shadow-lg"
                      : "text-slate-400 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <span className={cn(isActive ? "text-white" : "text-slate-500 group-hover:text-white")}>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Bottom items */}
          <div className="space-y-0.5 px-3 pb-4">
            <div className="mb-2 mt-4 h-px bg-white/10" />
            <a href="/overview" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-white/10 hover:text-white">
              <IconPlay />
              Walk through
            </a>
            <a href="/overview" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-white/10 hover:text-white">
              <IconRocket />
              Roadmap
            </a>

            {/* Credits */}
            {activeWorkspace && (
              <div className="mt-4 rounded-xl bg-white/5 px-3 py-3">
                <div className="mb-1.5 flex items-center justify-between text-xs text-slate-400">
                  <span>Kredyty AI</span>
                  <Badge variant="credits">{creditsLeft} / {creditsMonthly}</Badge>
                </div>
                <Progress value={creditsUsed} max={creditsMonthly || 1} />
              </div>
            )}

            {/* User */}
            <div className="mt-3 rounded-xl bg-white/5 px-3 py-3">
              <p className="truncate text-xs font-medium text-white">
                {user?.name ?? user?.email ?? "Użytkownik"}
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <a href="/account" className="text-[11px] text-slate-400 hover:text-white">Moje konto</a>
                <span className="text-slate-600">·</span>
                <form action="/api/auth/logout" method="post">
                  <button type="submit" className="text-[11px] text-slate-400 transition hover:text-white">
                    Wyloguj
                  </button>
                </form>
              </div>
            </div>
          </div>
        </aside>

        {/* ── MAIN AREA ── */}
        <div className="flex min-h-screen flex-col">
          <TrialBanner />

          <header className="sticky top-0 z-20 border-b border-[#E4E7F2] bg-white/95 backdrop-blur">
            <div className="flex h-16 items-center justify-between gap-4 px-6">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-[#1C2240]">{title}</p>
                {subtitle && <p className="truncate text-xs text-[#6E7693]">{subtitle}</p>}
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={activeWorkspace ? `/w/${activeWorkspace.workspace.slug}/content?new=1` : "/overview"}
                  className="hidden rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-gray-900 transition hover:bg-yellow-300 sm:block"
                >
                  + Nowy post
                </a>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#5B7CFA] text-sm font-bold text-white">
                  {(user?.name ?? user?.email ?? "U")[0]?.toUpperCase()}
                </div>
              </div>
            </div>
          </header>

          <main className="w-full flex-1 px-4 py-6 lg:px-8">
            <div className="mx-auto max-w-5xl">{children}</div>
            {actions && <div className="mx-auto mt-4 max-w-5xl">{actions}</div>}
          </main>
        </div>
      </div>
    </div>
  );
}
