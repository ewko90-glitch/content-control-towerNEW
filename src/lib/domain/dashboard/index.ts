import { fetchDashboardRaw } from "./queries";
import { composeSnapshot } from "./compute";
import type { DashboardSnapshot } from "./types";

export async function getDashboardSnapshot(workspaceId: string, userId: string, now: Date): Promise<DashboardSnapshot> {
  try {
    const raw = await fetchDashboardRaw(workspaceId, userId, now);
    return composeSnapshot(raw, now);
  } catch {
    return {
      generatedAt: now.toISOString(),
      workspace: {
        id: workspaceId,
        slug: "workspace",
        name: "Workspace",
        role: "VIEWER",
      },
      subtitle: "Panel działa w trybie awaryjnym.",
      metrics: {
        totalContent: 0,
        overdueCount: 0,
        overdueMaxAgeDays: 0,
        reviewCount: 0,
        reviewOver48hCount: 0,
        avgReviewHours: 0,
        upcomingToday: 0,
        upcomingTomorrow: 0,
        upcomingWeek: 0,
        noneUpcomingWeek: true,
        creditsRemaining: 0,
        monthlyCredits: 0,
        creditsUsedPct: 0,
        aiJobs7d: 0,
        contentCreated7d: 0,
        workflowEvents7d: 0,
        byStatus: {
          IDEA: 0,
          DRAFT: 0,
          REVIEW: 0,
          APPROVED: 0,
          SCHEDULED: 0,
          PUBLISHED: 0,
          ARCHIVED: 0,
        },
      },
      health: {
        score: 0,
        label: "Krytyczne",
        breakdown: [],
      },
      priority: {
        key: "fallback",
        severity: "warning",
        title: "Brak danych panelu",
        description: "Nie udało się obliczyć stanu dashboardu.",
        why: "Spróbuj odświeżyć stronę.",
        impact: { score: 0, label: "Niski" },
        confidence: { score: 0, label: "Niska" },
        cta: { label: "Odśwież", href: "/overview" },
        permissions: { canExecute: true },
      },
      actionCards: [],
      timeline: [
        { key: "today", title: "Dziś", items: [] },
        { key: "tomorrow", title: "Jutro", items: [] },
        { key: "week", title: "Ten tydzień", items: [] },
      ],
      insights: [],
      quickActions: [],
      emptyState: {
        title: "Zacznij budować swój system treści",
        steps: ["Dodaj pierwszą treść", "Zaplanuj publikację", "Użyj AI do przyspieszenia pracy"],
        cta: { label: "Dodaj treść", href: "/overview" },
      },
    };
  }
}
