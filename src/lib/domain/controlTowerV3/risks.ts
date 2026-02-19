import { permissionFor, permissionForAi } from "./permissions";
import type { Metrics, RiskSignal, WorkspaceContext } from "./types";
import { makeConfidence, makeImpact, severityFromImpact } from "./explain";

function buildBaseConfidence(metrics: Metrics) {
  const base = 0.45 + Math.min(metrics.workflowEventsTotal, 30) / 100;
  return makeConfidence(base);
}

export function buildRiskSignals(metrics: Metrics, workspace: WorkspaceContext): RiskSignal[] {
  const confidence = buildBaseConfidence(metrics);
  const risks: RiskSignal[] = [];

  if (metrics.overdueCount > 0) {
    const impactScore = Math.min(100, metrics.overdueCount * 14 + metrics.overdueMaxAgeDays * 8);
    risks.push({
      key: "risk-overdue",
      severity: severityFromImpact(impactScore),
      title: `Przeterminowane treści: ${metrics.overdueCount}`,
      description: "Część treści przekroczyła termin realizacji.",
      why: `Liczba zaległych elementów to ${metrics.overdueCount}, a najstarsze opóźnienie to ${metrics.overdueMaxAgeDays} dni. To obniża przewidywalność publikacji.`,
      impact: makeImpact(impactScore),
      confidence,
      cta: {
        label: "Przejdź do treści",
        href: `/w/${workspace.workspaceSlug}/content`,
      },
      permissions: permissionFor("EDITOR", workspace.role),
    });
  }

  if (metrics.reviewOver48hCount > 0) {
    const impactScore = Math.min(100, metrics.reviewOver48hCount * 16 + metrics.avgReviewHours * 0.9);
    risks.push({
      key: "risk-review-backlog",
      severity: severityFromImpact(impactScore),
      title: `Wąskie gardło REVIEW: ${metrics.reviewOver48hCount}`,
      description: "Elementy zbyt długo czekają na decyzję.",
      why: `W REVIEW ponad 48h znajduje się ${metrics.reviewOver48hCount} treści, a średni czas to ${metrics.avgReviewHours.toFixed(1)}h. Spowalnia to cały pipeline.`,
      impact: makeImpact(impactScore),
      confidence,
      cta: {
        label: "Otwórz kolejkę REVIEW",
        href: `/w/${workspace.workspaceSlug}/content`,
      },
      permissions: permissionFor("MANAGER", workspace.role),
    });
  }

  if (metrics.noneUpcomingWeek) {
    const impactScore = 78;
    risks.push({
      key: "risk-no-schedule",
      severity: severityFromImpact(impactScore),
      title: "Brak publikacji na ten tydzień",
      description: "Kalendarz nie ma zaplanowanych zadań.",
      why: "Brak zaplanowanych publikacji zwiększa ryzyko przestoju kanałów i spadku rytmu operacyjnego.",
      impact: makeImpact(impactScore),
      confidence,
      cta: {
        label: "Otwórz kalendarz",
        href: `/w/${workspace.workspaceSlug}/calendar`,
      },
      permissions: permissionFor("MANAGER", workspace.role),
    });
  }

  if (metrics.lowCredits || metrics.warningCredits) {
    const impactScore = metrics.lowCredits ? 68 : 42;
    const remainingPct = metrics.monthlyCredits > 0 ? Math.round((metrics.creditsRemaining / metrics.monthlyCredits) * 100) : 0;
    risks.push({
      key: "risk-credits",
      severity: severityFromImpact(impactScore),
      title: metrics.lowCredits ? "Niski poziom kredytów AI" : "Kredyty AI zbliżają się do limitu",
      description: `Pozostało około ${remainingPct}% miesięcznego budżetu AI.`,
      why: "Przy niskim budżecie AI część automatyzacji może być niedostępna, co spowolni pracę zespołu.",
      impact: makeImpact(impactScore),
      confidence,
      cta: {
        label: "Przejdź do treści AI",
        href: `/w/${workspace.workspaceSlug}/content`,
      },
      permissions: permissionForAi(workspace.role, metrics.creditsRemaining),
    });
  }

  if (metrics.inactivity) {
    const impactScore = 61;
    risks.push({
      key: "risk-inactivity",
      severity: severityFromImpact(impactScore),
      title: "Brak aktywności w ostatnich 7 dniach",
      description: "Pipeline nie wykazuje nowych działań.",
      why: "Brak nowych treści i wersji utrudnia utrzymanie ciągłości publikacji oraz planowanie działań zespołu.",
      impact: makeImpact(impactScore),
      confidence,
      cta: {
        label: "Utwórz nową treść",
        href: `/w/${workspace.workspaceSlug}/content`,
      },
      permissions: permissionFor("EDITOR", workspace.role),
    });
  }

  return risks.sort((a, b) => b.impact.score - a.impact.score).slice(0, 3);
}
