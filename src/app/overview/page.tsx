import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { getCachedControlTowerDecisionSnapshot } from "@/lib/domain/controlTowerV3/index";
import type { ControlTowerDecisionSnapshot } from "@/lib/domain/controlTowerV3/index";
import type { ActionTarget } from "@/lib/domain/controlTowerV3/index";
import { prisma } from "@/lib/prisma";
import { cn } from "@/styles/cn";

import { WelcomeFeatureCards } from "@/components/ui/WelcomeFeatureCards";
import { WelcomeModal } from "@/components/ui/WelcomeModal";
import { requireUser } from "../../lib/auth/session";

type TimelineTab = "today" | "tomorrow" | "week";

type OverviewPageProps = {
  searchParams: Promise<{ workspace?: string; timeline?: TimelineTab; analytics?: string }>;
};

type MembershipListItem = {
  id: string;
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
};

const timelineTabs: Array<{ key: TimelineTab; label: string }> = [
  { key: "today", label: "Dziś" },
  { key: "tomorrow", label: "Jutro" },
  { key: "week", label: "Tydzień" },
];

const severityClasses: Record<"info" | "warning" | "danger", string> = {
  info: "border-primary/20 bg-primarySoft",
  warning: "border-warning/40 bg-warning/20",
  danger: "border-danger/40 bg-danger/20",
};

const healthBadgeClass: Record<string, string> = {
  "Świetna forma": "bg-success/30 text-text border-success",
  Stabilnie: "bg-success/20 text-text border-success",
  "Wymaga uwagi": "bg-warning/40 text-text border-warning",
  Krytyczne: "bg-danger/30 text-text border-danger",
};

type OverviewSnapshotViewModel = {
  subtitle: string;
  emptyState?: {
    title: string;
    steps: string[];
    cta: {
      label: string;
      href: string;
    };
  };
  health: {
    score: number;
    label: "Świetna forma" | "Stabilnie" | "Wymaga uwagi" | "Krytyczne";
    breakdown: Array<{
      key: string;
      title: string;
      points: number;
      maxPoints: number;
      explanation: string;
      relatedHref?: string;
    }>;
  };
  priority: {
    severity: "info" | "warning" | "danger";
    title: string;
    description: string;
    why: string;
    impact: {
      score: number;
      label: "Niski" | "Średni" | "Wysoki" | "Krytyczny";
    };
    confidence: {
      score: number;
      label: "Niska" | "Średnia" | "Wysoka";
    };
    cta: {
      label: string;
      href: string;
    };
    permissions: {
      canExecute: boolean;
      reasonIfDisabled?: string;
    };
  };
  actionCards: Array<{
    key: string;
    severity: "info" | "warning" | "danger";
    title: string;
    description: string;
    why: string;
    impact: { score: number; label: "Niski" | "Średni" | "Wysoki" | "Krytyczny" };
    confidence: { score: number; label: "Niska" | "Średnia" | "Wysoka" };
    metricChip?: string;
    cta: { label: string; href: string };
    permissions: { canExecute: boolean; reasonIfDisabled?: string };
  }>;
  timeline: Array<{
    key: TimelineTab;
    title: "Dziś" | "Jutro" | "Ten tydzień";
    label: "Dziś" | "Jutro" | "Ten tydzień";
    items: Array<{
      id: string;
      title: string;
      time: string;
      channelLabel: string;
      status: string;
      href: string;
    }>;
    emptyCta?: {
      label: string;
      href: string;
    };
  }>;
  insights: Array<{
    key: string;
    text: string;
    severity: "info" | "warning" | "danger";
  }>;
  quickActions: Array<{
    key: string;
    label: string;
    href: string;
    disabled: boolean;
    reason?: string;
  }>;
};

function toSeverity(input: "low" | "medium" | "high" | undefined): "info" | "warning" | "danger" {
  if (input === "high") {
    return "danger";
  }
  if (input === "medium") {
    return "warning";
  }
  return "info";
}

function toHealthLabel(score: number): "Świetna forma" | "Stabilnie" | "Wymaga uwagi" | "Krytyczne" {
  if (score >= 85) {
    return "Świetna forma";
  }
  if (score >= 60) {
    return "Stabilnie";
  }
  if (score >= 40) {
    return "Wymaga uwagi";
  }
  return "Krytyczne";
}

function toImpactLabel(score: number): "Niski" | "Średni" | "Wysoki" | "Krytyczny" {
  if (score >= 75) {
    return "Krytyczny";
  }
  if (score >= 50) {
    return "Wysoki";
  }
  if (score >= 25) {
    return "Średni";
  }
  return "Niski";
}

function toConfidenceLabel(score: number): "Niska" | "Średnia" | "Wysoka" {
  if (score >= 0.75) {
    return "Wysoka";
  }
  if (score >= 0.4) {
    return "Średnia";
  }
  return "Niska";
}

function parseDeductionPoints(text: string): number {
  const match = text.match(/-(\d+(?:\.\d+)?)\s+points/i);
  if (!match) {
    return 0;
  }
  return Number(match[1]);
}

function buildHref(workspaceSlug: string, target?: ActionTarget, fallback?: string): string {
  if (!target) {
    return fallback ?? `/w/${workspaceSlug}/content`;
  }

  const basePath = target.route.startsWith("/") ? target.route : `/${target.route}`;
  const scopedPath = basePath.startsWith("/w/") || basePath.startsWith("/overview") ? basePath : `/w/${workspaceSlug}${basePath}`;

  const query = target.query
    ? Object.keys(target.query)
        .sort((left, right) => left.localeCompare(right))
        .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(target.query?.[key]))}`)
        .join("&")
    : "";

  const hash = target.hash ? `#${target.hash}` : "";
  const queryPart = query.length > 0 ? `?${query}` : "";

  return `${scopedPath}${queryPart}${hash}`;
}

function mapDecisionToOverviewViewModel(
  decision: ControlTowerDecisionSnapshot,
  context: { workspaceSlug: string; workspaceName: string },
): OverviewSnapshotViewModel {
  const structuralScorePct = Math.round((decision.structuralRiskScore ?? 0) * 100);
  const confidenceScore = decision.riskFlags.length > 0 ? Math.max(...decision.riskFlags.map((flag) => flag.intensity)) : 0.35;

  const breakdown = decision.reasoning.scoreBreakdown.map((entry, index) => {
    const deduction = parseDeductionPoints(entry);
    const points = Math.max(0, 100 - Math.round(deduction));

    return {
      key: `breakdown-${index + 1}`,
      title: entry.split(":")[0] ?? `Pozycja ${index + 1}`,
      points,
      maxPoints: 100,
      explanation: entry,
      relatedHref: `/w/${context.workspaceSlug}/content`,
    };
  });

  const mappedActions = decision.actionCards.map((card) => ({
    key: card.id ?? card.key,
    severity: card.severity,
    title: card.title,
    description: card.description,
    why: card.why,
    impact: {
      score: card.impact.score,
      label: card.impact.label,
    },
    confidence: {
      score: card.confidence.score,
      label: card.confidence.label,
    },
    metricChip: card.urgency ? `Urgencja: ${card.urgency}` : card.metricChip,
    cta: {
      label: card.cta.label,
      href: buildHref(context.workspaceSlug, card.target, card.cta.href),
    },
    permissions: {
      canExecute: card.permissions.canExecute,
      reasonIfDisabled: card.permissions.reasonIfDisabled,
    },
  }));

  const timelineItems = mappedActions.slice(0, 5).map((card, index) => ({
    id: `timeline-${index + 1}`,
    title: card.title,
    time: index === 0 ? "Teraz" : `${index + 1}h`,
    channelLabel: card.metricChip ?? "Operacje",
    status: card.severity === "danger" ? "Wysoki" : card.severity === "warning" ? "Średni" : "Niski",
    href: card.cta.href,
  }));

  const insights = [
    ...decision.reasoning.mainRiskDrivers.map((driver, index) => ({
      key: `driver-${index + 1}`,
      text: driver,
      severity: "warning" as const,
    })),
    ...decision.riskFlags.map((flag) => ({
      key: flag.id,
      text: flag.message,
      severity: toSeverity(flag.level),
    })),
  ].slice(0, 6);

  const quickActions = mappedActions.slice(0, 4).map((action) => ({
    key: action.key,
    label: action.title,
    href: action.cta.href,
    disabled: !action.permissions.canExecute,
    reason: action.permissions.reasonIfDisabled,
  }));

  return {
    subtitle: `Ryzyko: ${decision.riskLevel.toUpperCase()} • Workspace: ${context.workspaceName}`,
    emptyState:
      mappedActions.length === 0
        ? {
            title: "Brak aktywnych akcji",
            steps: decision.reasoning.scoreBreakdown.slice(0, 3),
            cta: {
              label: "Odśwież dane",
              href: `/overview?workspace=${context.workspaceSlug}`,
            },
          }
        : undefined,
    health: {
      score: decision.healthScore,
      label: toHealthLabel(decision.healthScore),
      breakdown,
    },
    priority: {
      severity: toSeverity(decision.priorityToday.severity),
      title: decision.priorityToday.type,
      description: decision.priorityToday.message,
      why: decision.reasoning.structuralSummary,
      impact: {
        score: structuralScorePct,
        label: toImpactLabel(structuralScorePct),
      },
      confidence: {
        score: confidenceScore,
        label: toConfidenceLabel(confidenceScore),
      },
      cta: {
        label: "Przejdź do treści",
        href: `/w/${context.workspaceSlug}/content`,
      },
      permissions: {
        canExecute: true,
      },
    },
    actionCards: mappedActions,
    timeline: [
      {
        key: "today",
        title: "Dziś",
        label: "Dziś",
        items: timelineItems,
        emptyCta:
          timelineItems.length === 0
            ? {
                label: "Dodaj pierwszą akcję",
                href: `/w/${context.workspaceSlug}/content`,
              }
            : undefined,
      },
      {
        key: "tomorrow",
        title: "Jutro",
        label: "Jutro",
        items: [],
      },
      {
        key: "week",
        title: "Ten tydzień",
        label: "Ten tydzień",
        items: [],
      },
    ],
    insights,
    quickActions,
  };
}

export default async function OverviewPage({ searchParams }: OverviewPageProps) {
  const user = await requireUser();
  const params = await searchParams;

  const memberships = (await prisma.workspaceMembership.findMany({
    where: {
      userId: user.id,
      workspace: { deletedAt: null },
    },
    include: {
      workspace: {
        select: { id: true, name: true, slug: true },
      },
    },
    orderBy: { createdAt: "asc" },
  })) as MembershipListItem[];

  if (memberships.length === 0) {
    redirect("/onboarding");
  }

  const preference = await prisma.userPreference.findUnique({
    where: { userId: user.id },
    select: { lastWorkspaceId: true },
  });

  const activeMembership =
    memberships.find((membership) => membership.workspace.slug === params.workspace) ??
    memberships.find((membership) => membership.workspace.id === preference?.lastWorkspaceId) ??
    memberships[0];

  let snapshot: OverviewSnapshotViewModel | null = null;
  let loadError = false;

  try {
    const decision = await getCachedControlTowerDecisionSnapshot({
      workspaceId: activeMembership.workspace.id,
      viewer: {
        userId: user.id,
      },
    });

    snapshot = mapDecisionToOverviewViewModel(decision, {
      workspaceSlug: activeMembership.workspace.slug,
      workspaceName: activeMembership.workspace.name,
    });
  } catch (error) {
    loadError = true;
    if (process.env.NODE_ENV !== "production") {
      console.error(error);
    }
  }

  const selectedTimeline = params.timeline ?? "today";
  const timelineGroup = snapshot?.timeline.find((group) => group.key === selectedTimeline) ?? snapshot?.timeline[0];
  const showAnalytics = params.analytics === "1";

  // --- Dashboard data queries ---
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const weekStart = new Date(todayStart);
  const dayOfWeek = weekStart.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  weekStart.setDate(weekStart.getDate() + mondayOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  let todayItems: Array<{ id: string; title: string; dueAt: Date | null; channel: { name: string; type: string } | null }> = [];
  try {
    todayItems = await prisma.contentItem.findMany({
      where: {
        workspaceId: activeMembership.workspace.id,
        dueAt: { gte: todayStart, lte: todayEnd },
        deletedAt: null,
      },
      include: { channel: { select: { name: true, type: true } } },
      orderBy: { dueAt: "asc" },
      take: 3,
    });
  } catch { /* empty */ }

  let weekItems: Array<{ dueAt: Date | null }> = [];
  try {
    weekItems = await prisma.contentItem.findMany({
      where: {
        workspaceId: activeMembership.workspace.id,
        dueAt: { gte: weekStart, lte: weekEnd },
        deletedAt: null,
      },
      select: { dueAt: true },
    });
  } catch { /* empty */ }

  let overdueItems: Array<{ id: string; title: string; dueAt: Date | null }> = [];
  try {
    overdueItems = await prisma.contentItem.findMany({
      where: {
        workspaceId: activeMembership.workspace.id,
        dueAt: { lt: todayStart },
        status: { not: "PUBLISHED" },
        deletedAt: null,
      },
      orderBy: { dueAt: "asc" },
      take: 3,
    });
  } catch { /* empty */ }

  return (
    <AppShell
      title="Panel dowodzenia"
      subtitle={snapshot?.subtitle ?? `Aktywny workspace: ${activeMembership.workspace.name}`}
      activeHref="/overview"
      workspaceSlug={activeMembership.workspace.slug}
    >
      <WelcomeModal />
      {/* ========== PRZEŁĄCZNIK TRYBU ========== */}
      <div className="mb-4 flex gap-2">
        <a
          href={`/overview?workspace=${activeMembership.workspace.slug}`}
          className={
            !showAnalytics
              ? "rounded-xl bg-[#0F172A] px-4 py-2 text-sm font-medium text-white"
              : "rounded-xl border border-border bg-surface2 px-4 py-2 text-sm text-text"
          }
        >
          Widok użytkownika
        </a>
        <a
          href={`/overview?workspace=${activeMembership.workspace.slug}&analytics=1`}
          className={
            showAnalytics
              ? "rounded-xl bg-[#0F172A] px-4 py-2 text-sm font-medium text-white"
              : "rounded-xl border border-border bg-surface2 px-4 py-2 text-sm text-text"
          }
        >
          Widok analityczny
        </a>
      </div>

      {/* ========== BANER POWITALNY ========== */}
      <div className="mb-5 flex items-center justify-between rounded-2xl bg-[#0F172A] p-6">
        <div>
          <p className="text-2xl font-semibold text-white">
            Dzień dobry, {user.name ?? user.email}
          </p>
          <p className="mt-1 text-sm capitalize text-slate-400">
            {new Date().toLocaleDateString("pl-PL", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>
        <a
          href={`/w/${activeMembership.workspace.slug}/content?new=1`}
          className="ml-auto inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#0F172A] transition-colors hover:bg-slate-100"
        >
          Napisz post
        </a>
      </div>

      {/* ========== GRID: DZIŚ / TEN TYDZIEŃ ========== */}
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* KARTA: Dziś do zrobienia */}
        <Card className="rounded-2xl border border-border shadow-soft">
          <CardHeader>
            <CardTitle>Dziś do zrobienia</CardTitle>
          </CardHeader>
          <CardContent>
            {todayItems.length === 0 ? (
              <>
                <p className="text-sm text-muted">Brak postów zaplanowanych na dziś</p>
                <a
                  href={`/w/${activeMembership.workspace.slug}/calendar`}
                  className="mt-2 inline-block text-xs text-primary hover:underline"
                >
                  Zaplanuj w kalendarzu
                </a>
              </>
            ) : (
              <div className="space-y-2">
                {todayItems.map((item) => {
                  const channelType = item.channel?.type ?? "";
                  const dotClass =
                    channelType === "LINKEDIN"
                      ? "bg-[#0A66C2]"
                      : channelType === "INSTAGRAM"
                        ? "bg-[#C13584]"
                        : channelType === "BLOG" || channelType === "WEBSITE"
                          ? "bg-[#1A9E6E]"
                          : "bg-[#5B7CFA]";
                  const timeLabel = item.dueAt
                    ? item.dueAt.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })
                    : "—";
                  return (
                    <div key={item.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface2 p-3">
                      <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${dotClass}`} />
                      <div className="flex-1 overflow-hidden">
                        <p className="truncate text-sm font-medium text-text">{item.title}</p>
                        <p className="text-xs text-muted">
                          {item.channel?.name ?? "Brak kanału"} · {timeLabel}
                        </p>
                      </div>
                      <a
                        href={`/w/${activeMembership.workspace.slug}/content/${item.id}`}
                        className="flex-shrink-0 text-xs text-primary hover:underline"
                      >
                        Otwórz
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* KARTA: Ten tydzień */}
        <Card className="rounded-2xl border border-border shadow-soft">
          <CardHeader>
            <CardTitle>Ten tydzień</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex gap-2">
              {Array.from({ length: 7 }, (_, i) => {
                const dayDate = new Date(weekStart);
                dayDate.setDate(dayDate.getDate() + i);
                const hasPost = weekItems.some((w) => {
                  if (!w.dueAt) return false;
                  const d = new Date(w.dueAt);
                  return (
                    d.getFullYear() === dayDate.getFullYear() &&
                    d.getMonth() === dayDate.getMonth() &&
                    d.getDate() === dayDate.getDate()
                  );
                });
                return (
                  <span
                    key={i}
                    className={`h-8 w-8 rounded-full ${
                      hasPost
                        ? "bg-[#5B7CFA]"
                        : "border-2 border-border bg-surface2"
                    }`}
                    title={dayDate.toLocaleDateString("pl-PL", { weekday: "short", day: "numeric" })}
                  />
                );
              })}
            </div>
            <p className="text-sm text-muted">
              {weekItems.length} z 7 zaplanowanych w tym tygodniu
            </p>
            <a
              href={`/w/${activeMembership.workspace.slug}/calendar`}
              className="mt-3 inline-flex rounded-xl border border-border bg-surface2 px-3 py-1.5 text-sm text-text transition-colors hover:bg-surface"
            >
              Otwórz kalendarz
            </a>
          </CardContent>
        </Card>
      </div>

      {/* ========== KARTA: ZALEGŁOŚCI ========== */}
      <Card className="mb-5 rounded-2xl border border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle>Zaległości</CardTitle>
        </CardHeader>
        <CardContent>
          {overdueItems.length === 0 ? (
            <p className="text-sm text-green-700">Brak zaległości</p>
          ) : (
            <div className="space-y-2">
              {overdueItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-red-200 bg-white p-3"
                >
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-sm font-medium text-text">{item.title}</p>
                    <p className="text-xs text-muted">
                      Miało być{" "}
                      {item.dueAt
                        ? item.dueAt.toLocaleDateString("pl-PL", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })
                        : "—"}
                    </p>
                  </div>
                  <a
                    href={`/w/${activeMembership.workspace.slug}/content/${item.id}?edit=1`}
                    className="ml-4 flex-shrink-0 text-xs text-red-600 hover:underline"
                  >
                    Napisz
                  </a>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showAnalytics && (
        <>
      <Card className="mb-5 rounded-2xl border border-border bg-primarySoft/40 shadow-soft">
        <CardHeader>
          <CardTitle>Executive</CardTitle>
          <p className="text-sm text-muted">Board-ready intelligence: Pack, ROI, Risk, Brief.</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <a href={`/w/${activeMembership.workspace.slug}/portfolio/executive`}>
              <Button>Open Executive Hub</Button>
            </a>
            <a href="/portfolio/executive-report">
              <Button variant="ghost">Board Pack</Button>
            </a>
            <a href={`/w/${activeMembership.workspace.slug}/portfolio/executive/brief`}>
              <Button size="sm" variant="ghost">
                Weekly Brief
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {loadError ? (
        <Card className="rounded-2xl border-danger/40 bg-danger/10 shadow-sm">
          <CardHeader>
            <CardTitle>Nie udało się wczytać panelu dowodzenia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted">Spróbuj odświeżyć stronę.</p>
            <a href={`/overview?workspace=${activeMembership.workspace.slug}`}>
              <Button size="sm">Odśwież</Button>
            </a>
          </CardContent>
        </Card>
      ) : null}

      {!snapshot ? null : snapshot.emptyState ? (
        <Card className="rounded-2xl bg-primarySoft/70 shadow-sm transition-all duration-200 hover:shadow-md">
          <CardHeader>
            <CardTitle>{snapshot.emptyState.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal space-y-2 pl-5 text-sm text-muted">
              {snapshot.emptyState.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <a href={snapshot.emptyState.cta.href}>
              <Button>{snapshot.emptyState.cta.label}</Button>
            </a>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>Zdrowie operacyjne</CardTitle>
                  <Badge className={cn(healthBadgeClass[snapshot.health.label] ?? healthBadgeClass.Stabilnie)}>{snapshot.health.label}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-end justify-between">
                  <p className="text-4xl font-semibold text-text">{snapshot.health.score}</p>
                  <Badge variant="status">Pewność: {snapshot.priority.confidence.label}</Badge>
                </div>

                <details className="rounded-xl border border-border bg-surface2 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-text">Dlaczego?</summary>
                  <ul className="mt-3 space-y-2 text-sm text-muted">
                    {snapshot.health.breakdown.map((item) => (
                      <li key={item.key} className="rounded-lg bg-surface px-3 py-2">
                        <p className="font-medium text-text">
                          {item.title}: {item.points}/{item.maxPoints}
                        </p>
                        <p>{item.explanation}</p>
                        <a href={item.relatedHref} className="text-xs text-primary hover:underline">
                          Przejdź
                        </a>
                      </li>
                    ))}
                  </ul>
                </details>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-text">Największe ograniczenia</p>
                  <ul className="space-y-1 text-sm text-muted">
                    {snapshot.health.breakdown.slice(0, 2).map((entry) => (
                      <li key={entry.key}>
                        <a href={entry.relatedHref} className="hover:text-primary">
                          • {entry.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card className={cn("border", severityClasses[snapshot.priority.severity])}>
              <CardHeader>
                <CardTitle>Priorytet dnia</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-lg font-semibold text-text">{snapshot.priority.title}</p>
                <p className="text-sm text-muted">{snapshot.priority.description}</p>
                <Alert variant={snapshot.priority.severity === "danger" ? "danger" : snapshot.priority.severity === "warning" ? "warning" : "info"}>
                  {snapshot.priority.why}
                </Alert>
                <div className="flex items-center gap-2 text-xs text-muted">
                  <Badge variant="status">Wpływ: {snapshot.priority.impact.label} ({snapshot.priority.impact.score})</Badge>
                  <Badge variant="status">Pewność: {snapshot.priority.confidence.label}</Badge>
                </div>
                <div title={snapshot.priority.permissions.reasonIfDisabled ?? ""}>
                  <a href={snapshot.priority.cta.href}>
                    <Button disabled={!snapshot.priority.permissions.canExecute}>{snapshot.priority.cta.label}</Button>
                  </a>
                  {!snapshot.priority.permissions.canExecute ? (
                    <p className="mt-2 text-xs text-muted">{snapshot.priority.permissions.reasonIfDisabled}</p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Karty akcji</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {snapshot.actionCards.map((card) => (
                  <div key={card.key} className={cn("rounded-xl border p-3", severityClasses[card.severity])}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="font-medium text-text">{card.title}</p>
                      {card.metricChip ? <Badge variant="status">{card.metricChip}</Badge> : null}
                    </div>
                    <p className="text-sm text-muted">{card.description}</p>
                    <p className="mt-2 text-xs text-muted">{card.why}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <Badge variant="status">Wpływ: {card.impact.label}</Badge>
                      <Badge variant="status">Pewność: {card.confidence.label}</Badge>
                    </div>
                    <div className="mt-3" title={card.permissions.reasonIfDisabled ?? ""}>
                      <a href={card.cta.href}>
                        <Button size="sm" disabled={!card.permissions.canExecute}>
                          {card.cta.label}
                        </Button>
                      </a>
                      {!card.permissions.canExecute ? <p className="mt-1 text-xs text-muted">{card.permissions.reasonIfDisabled}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>Agenda operacyjna</CardTitle>
                  <div className="flex gap-1">
                    {timelineTabs.map((tab) => (
                      <a key={tab.key} href={`/overview?workspace=${activeMembership.workspace.slug}&timeline=${tab.key}`}>
                        <Button size="sm" variant={selectedTimeline === tab.key ? "secondary" : "ghost"}>
                          {tab.label}
                        </Button>
                      </a>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!timelineGroup || timelineGroup.items.length === 0 ? (
                  <Alert variant="info">
                    Brak pozycji w sekcji „{timelineGroup?.title ?? "Dziś"}”.
                    {timelineGroup?.emptyCta ? (
                      <a href={timelineGroup.emptyCta.href} className="ml-1 text-primary underline">
                        {timelineGroup.emptyCta.label}
                      </a>
                    ) : null}
                  </Alert>
                ) : (
                  <ul className="space-y-2">
                    {timelineGroup.items.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface2 px-3 py-2">
                        <div>
                          <p className="font-medium text-text">{item.title}</p>
                          <p className="text-xs text-muted">
                            {item.time} • {item.channelLabel}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="status">{item.status}</Badge>
                          <a href={item.href} className="text-xs text-primary hover:underline">
                            Otwórz
                          </a>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Insighty</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {snapshot.insights.map((insight) => (
                  <div key={insight.key} className={cn("rounded-xl border px-3 py-2 text-sm", severityClasses[insight.severity])}>
                    {insight.text}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Szybkie akcje</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {snapshot.quickActions.map((action) => (
                  <div key={action.key} title={action.reason ?? ""}>
                    <a href={action.href}>
                      <Button variant={action.key === "create" ? "primary" : "ghost"} disabled={action.disabled}>
                        {action.label}
                      </Button>
                    </a>
                    {action.disabled && action.reason ? <p className="mt-1 text-xs text-muted">{action.reason}</p> : null}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
        </>
      )}

      {/* ── KARTY FUNKCJI (jak NapoleonCat welcome screen) ── */}
      <WelcomeFeatureCards workspaceSlug={activeMembership.workspace.slug} />
    </AppShell>
  );
}
