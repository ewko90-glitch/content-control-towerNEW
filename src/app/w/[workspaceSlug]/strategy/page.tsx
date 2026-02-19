import { notFound } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { requireWorkspaceAccess } from "@/lib/auth/workspace";
import {
  computeStrategicAlignment,
  getCachedControlTowerDecisionSnapshot,
  getRecentOutcomes,
  getStrategicArtifacts,
  strategyCopy,
  type StrategicArtifact,
} from "@/lib/domain/controlTowerV3";
import { type StrategicMove } from "@/modules/controlTowerV3/strategy/moves";
import { getOrGenerateWeeklyMoves } from "@/modules/controlTowerV3/strategy/movesStore";
import { cn } from "@/styles/cn";

type StrategyPageProps = {
  params: Promise<{ workspaceSlug: string }>;
};

function neutralAlignment(): ReturnType<typeof computeStrategicAlignment> {
  return {
    alignmentScore: 50,
    confidence: "low",
    driftDetected: false,
    driftReason: "Brak wystarczających danych do oceny dryfu.",
    topAligned: [],
    topMisaligned: [],
    recommendedCorrections: [],
    diagnostics: {
      inputs: {
        artifacts: 0,
        actions: 0,
        outcomes: 0,
      },
      notes: ["fallback:neutral"],
    },
  };
}

function byType(artifacts: StrategicArtifact[], type: StrategicArtifact["type"]) {
  return artifacts.filter((artifact) => artifact.type === type);
}

function scoreTone(score: number): string {
  if (score >= 80) {
    return "text-success";
  }
  if (score >= 60) {
    return "text-warning";
  }
  return "text-danger";
}

function sectionTitle(type: StrategicArtifact["type"]): string {
  if (type === "priority") {
    return strategyCopy.sections.priorities;
  }
  if (type === "experiment") {
    return strategyCopy.sections.experiments;
  }
  if (type === "hypothesis") {
    return strategyCopy.sections.hypotheses;
  }
  if (type === "assumption") {
    return strategyCopy.sections.assumptions;
  }
  return strategyCopy.sections.decisions;
}

function moveBadgeLabel(kind: StrategicMove["kind"]): string {
  if (kind === "focus") {
    return "Focus";
  }
  if (kind === "stability") {
    return "Stability";
  }
  return "Optimization";
}

function moveBadgeTone(kind: StrategicMove["kind"]): string {
  if (kind === "focus") {
    return "bg-primary/20 text-text border-border";
  }
  if (kind === "stability") {
    return "bg-warning/30 text-text border-border";
  }
  return "bg-secondary/25 text-text border-border";
}

function riskTone(risk: StrategicMove["risk"]): string {
  if (risk === "high") {
    return "text-danger";
  }
  if (risk === "medium") {
    return "text-warning";
  }
  return "text-success";
}

export default async function StrategyPage({ params }: StrategyPageProps) {
  const routeParams = await params;

  try {
    const access = await requireWorkspaceAccess(routeParams.workspaceSlug, "VIEWER");

    const [artifacts, outcomes, decision] = await Promise.all([
      getStrategicArtifacts(access.workspace.id),
      getRecentOutcomes({ workspaceId: access.workspace.id, windowHours: 24 * 14 }),
      getCachedControlTowerDecisionSnapshot({
        workspaceId: access.workspace.id,
        viewer: {
          userId: access.user.id,
          role: access.membership.role,
        },
      }),
    ]);

    const actionCards = Array.isArray(decision.actionCards) ? decision.actionCards : [];

    const recentActions = actionCards.map((item, index) => ({
      id: item.id ?? `action-${index + 1}`,
      title: item.title,
      type: item.type,
      kind: item.intent,
      status: item.permissions?.canExecute ? "open" : "blocked",
      createdAt: decision.generatedAt,
    }));

    let alignment = neutralAlignment();
    try {
      alignment = computeStrategicAlignment({
        artifacts,
        recentActions,
        outcomes,
        nowIso: decision.generatedAt,
      });
    } catch {
      alignment = neutralAlignment();
    }

    let weeklyMoves: StrategicMove[] = [];
    try {
      weeklyMoves = await getOrGenerateWeeklyMoves({
        workspaceId: access.workspace.id,
        nowIso: decision.generatedAt,
        artifacts,
        alignment,
        recentActions,
        outcomes: outcomes.map((outcome) => ({
          createdAt: outcome.occurredAt,
          occurredAt: outcome.occurredAt,
          outcome: outcome.outcome,
        })),
      });
    } catch {
      weeklyMoves = await getOrGenerateWeeklyMoves({
        workspaceId: access.workspace.id,
        nowIso: decision.generatedAt,
        artifacts: [],
        alignment: neutralAlignment(),
        recentActions: [],
        outcomes: [],
      });
    }

    const activeArtifacts = artifacts.filter((artifact) => artifact.status === "active");
    const archivedArtifacts = artifacts.filter((artifact) => artifact.status === "archived").slice(0, 6);

    return (
      <AppShell
        title={`Workspace: ${access.workspace.name}`}
        subtitle="Strategic Brain"
        activeHref={`/w/${access.workspace.slug}/strategy`}
        workspaceSlug={access.workspace.slug}
      >
        <PageHeader title={strategyCopy.heroTitle} subtitle={strategyCopy.heroSubtitle} />

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>This Week’s Strategic Moves</CardTitle>
            <p className="text-sm text-muted">A 7-day plan generated from your strategy and execution signals.</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              {weeklyMoves.map((move) => (
                <div key={move.id} className="rounded-xl border border-border bg-surface2 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Badge variant="status" className={moveBadgeTone(move.kind)}>
                      {moveBadgeLabel(move.kind)}
                    </Badge>
                    <span className="text-[11px] text-muted">{move.weekKey}</span>
                  </div>

                  <p className="text-sm font-semibold text-text">{move.title}</p>
                  <p className="mt-1 text-xs text-muted">{move.why}</p>

                  <p className="mt-3 text-xs text-muted">Success metric</p>
                  <p className="text-sm text-text">{move.successMetric}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="rounded-full border border-border bg-bg px-2 py-1 text-muted">Effort: {move.effort}</span>
                    <span className={cn("rounded-full border border-border bg-bg px-2 py-1", riskTone(move.risk))}>Risk: {move.risk}</span>
                    <span className="rounded-full border border-border bg-bg px-2 py-1 text-muted">Confidence: {move.expectedImpact.confidence}</span>
                    <span className="rounded-full border border-border bg-bg px-2 py-1 text-muted">
                      Expected impact: {move.expectedImpact.healthScoreDelta >= 0 ? "+" : ""}
                      {move.expectedImpact.healthScoreDelta}
                    </span>
                  </div>

                  <p className="mt-3 text-xs font-medium text-text">Recommended actions</p>
                  <ul className="mt-1 space-y-1">
                    {move.recommendedActions.map((action: StrategicMove["recommendedActions"][number]) => (
                      <li key={`${move.id}-${action.title}`} className="text-xs text-muted">
                        • {action.title}
                      </li>
                    ))}
                  </ul>

                  {move.linkedArtifacts.length > 0 ? (
                    <>
                      <p className="mt-3 text-xs font-medium text-text">Linked artifacts</p>
                      <ul className="mt-1 space-y-1">
                        {move.linkedArtifacts.map((artifact: StrategicMove["linkedArtifacts"][number]) => (
                          <li key={`${move.id}-${artifact.artifactId}`} className="text-xs text-muted">
                            {artifact.title}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Alignment Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="status" className={cn("border-border", alignment.driftDetected ? "bg-danger/20" : "bg-success/20")}>{
                  alignment.driftDetected ? strategyCopy.badges.drifting : strategyCopy.badges.aligned
                }</Badge>
                <Badge variant="status" className="bg-surface2 text-text border-border">
                  confidence: {alignment.confidence}
                </Badge>
              </div>

              <div className="rounded-xl border border-border bg-surface2 p-3">
                <p className="text-xs text-muted">Alignment Score</p>
                <p className={cn("text-3xl font-semibold", scoreTone(alignment.alignmentScore))}>{alignment.alignmentScore}/100</p>
                <p className="mt-1 text-xs text-muted">
                  Active artifacts: {activeArtifacts.length} • Actions analyzed: {alignment.diagnostics.inputs.actions}
                </p>
              </div>

              {alignment.driftReason ? <p className="text-sm text-muted">{alignment.driftReason}</p> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{strategyCopy.recommendationsTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              {alignment.recommendedCorrections.length > 0 ? (
                <ul className="space-y-2">
                  {alignment.recommendedCorrections.map((item) => (
                    <li key={item.title} className="rounded-lg border border-border bg-surface2 p-2 text-sm">
                      <p className="font-medium text-text">{item.title}</p>
                      <p className="text-xs text-muted">{item.why}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-wide text-muted">effort: {item.effort}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">{strategyCopy.emptyStates.noActions}</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {(["priority", "experiment", "hypothesis", "assumption", "decision"] as const).map((type) => {
            const items = byType(activeArtifacts, type);
            return (
              <Card key={type}>
                <CardHeader>
                  <CardTitle>{sectionTitle(type)}</CardTitle>
                </CardHeader>
                <CardContent>
                  {items.length === 0 ? (
                    <p className="text-sm text-muted">{strategyCopy.emptyStates.noArtifacts}</p>
                  ) : (
                    <ul className="space-y-2">
                      {items.slice(0, 6).map((item) => (
                        <li key={item.id} className="rounded-lg border border-border bg-surface2 p-2">
                          <p className="text-sm font-medium text-text">{item.title}</p>
                          <p className="text-xs text-muted">{item.intent}</p>
                          {item.successMetric ? <p className="mt-1 text-xs text-muted">metric: {item.successMetric}</p> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{strategyCopy.sections.archive}</CardTitle>
          </CardHeader>
          <CardContent>
            {archivedArtifacts.length === 0 ? (
              <p className="text-sm text-muted">Brak zarchiwizowanych artefaktów.</p>
            ) : (
              <ul className="space-y-2">
                {archivedArtifacts.map((item) => (
                  <li key={item.id} className="rounded-lg border border-border bg-surface2 p-2">
                    <p className="text-sm font-medium text-text">{item.title}</p>
                    <p className="text-xs text-muted">{item.intent}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </AppShell>
    );
  } catch {
    notFound();
  }
}
