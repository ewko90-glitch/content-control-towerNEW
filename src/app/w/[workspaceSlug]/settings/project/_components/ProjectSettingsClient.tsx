"use client";

import { useMemo, useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  canExportPdf,
  canUseAi,
  getEntitlements,
  getProjectPolicies,
  getUsage,
  type PolicyAuditEntry,
  type ProjectPolicies,
  type UsageBlockReason,
  updateProjectPolicies,
} from "@/lib/projectStore";
import { uiCopy } from "@/lib/uiCopy";

const t = uiCopy.pl;

function planLabel(value: string): string {
  if (value === "starter") return t.plans.starter;
  if (value === "growth") return t.plans.growth;
  if (value === "control_tower") return t.plans.controlTower;
  return t.plans.enterprise;
}

function planDescription(value: string): string {
  if (value === "starter") return t.plans.starterDesc;
  if (value === "growth") return t.plans.growthDesc;
  if (value === "control_tower") return t.plans.controlTowerDesc;
  return t.plans.enterpriseDesc;
}

function formatDateLabel(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleString("pl-PL");
}

function reasonLabel(reason?: UsageBlockReason): string {
  if (!reason) return "—";
  if (reason === "AI_DISABLED_BY_POLICY") return t.limits.aiDisabledByPolicy;
  if (reason === "AI_MONTHLY_LIMIT_REACHED") return t.limits.reachedAiMonthly;
  if (reason === "PDF_NOT_AVAILABLE_IN_PLAN") return t.limits.pdfNotInPlan;
  if (reason === "PDF_MONTHLY_LIMIT_REACHED") return t.limits.reachedPdfMonthly;
  return "—";
}

function policyStatusLabel(policies: ProjectPolicies): "Aktywne" | "Wyłączone" | "Limit osiągnięty" {
  if (!policies.ai.enabled) return "Wyłączone";
  if (policies.ai.usageThisMonth >= policies.ai.monthlyLimit) return "Limit osiągnięty";
  return "Aktywne";
}

function policyStatusTone(policies: ProjectPolicies): string {
  if (!policies.ai.enabled) return "bg-surface2 text-muted";
  if (policies.ai.usageThisMonth >= policies.ai.monthlyLimit) return "bg-surface2 text-text";
  return "bg-primary text-primary-foreground";
}

function updateAndSync(
  workspaceId: string,
  patch: Parameters<typeof updateProjectPolicies>[1],
  actor: string,
  setPolicies: (next: ProjectPolicies) => void,
): void {
  const next = updateProjectPolicies(workspaceId, patch, actor);
  setPolicies(next);
}

type Props = {
  workspaceSlug: string;
};

export function ProjectSettingsClient({ workspaceSlug }: Props) {
  const actor = "settings-project-ui";

  const [policies, setPolicies] = useState<ProjectPolicies>(() => getProjectPolicies(workspaceSlug));
  const [monthlyLimitInput, setMonthlyLimitInput] = useState<string>(() => String(policies.ai.monthlyLimit));
  const [showFullHistory, setShowFullHistory] = useState<boolean>(false);

  const statusLabel = useMemo(() => policyStatusLabel(policies), [policies]);
  const statusTone = useMemo(() => policyStatusTone(policies), [policies]);
  const entitlements = useMemo(() => getEntitlements(workspaceSlug), [policies, workspaceSlug]);
  const usage = useMemo(() => getUsage(workspaceSlug), [policies, workspaceSlug]);
  const aiGuard = useMemo(() => canUseAi(workspaceSlug), [policies, workspaceSlug]);
  const pdfGuard = useMemo(() => canExportPdf(workspaceSlug), [policies, workspaceSlug]);

  const latestEntries = useMemo(() => {
    return [...policies.policyAudit].reverse().slice(0, 10);
  }, [policies.policyAudit]);

  const visibleEntries = useMemo<PolicyAuditEntry[]>(() => {
    if (showFullHistory) return [...policies.policyAudit].reverse();
    return latestEntries;
  }, [latestEntries, policies.policyAudit, showFullHistory]);

  return (
    <>
      <PageHeader
        title="Polityki projektu"
        subtitle="Deterministyczna warstwa nadzoru dla AI i publikacji."
      />

      <div className="space-y-4">
        <Card className="rounded-2xl border border-border bg-surface shadow-soft">
          <CardHeader>
            <CardTitle>{t.limits.planAndLimits}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div id="plan-i-limity" className="rounded-xl border border-border bg-surface2 p-3">
              <p className="text-sm font-medium text-text">{t.limits.currentPlan}: <span className="font-semibold">{planLabel(entitlements.plan)}</span></p>
              <p className="mt-1 text-xs text-muted">{planDescription(entitlements.plan)}</p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-border bg-surface2 p-3">
                <p className="mb-2 text-sm font-medium text-text">{t.limits.limits}</p>
                <ul className="space-y-1 text-sm text-text">
                  <li>{t.limits.seats}: <span className="font-semibold">{entitlements.seatsLimit}</span></li>
                  <li>{t.limits.aiPerMonth}: <span className="font-semibold">{entitlements.aiMonthlyLimit}</span></li>
                  <li>{t.limits.pdfPerMonth}: <span className="font-semibold">{entitlements.pdfMonthlyLimit}</span></li>
                </ul>
              </div>

              <div className="rounded-xl border border-border bg-surface2 p-3">
                <p className="mb-2 text-sm font-medium text-text">{t.limits.usage}</p>
                <ul className="space-y-1 text-sm text-text">
                  <li>{t.limits.seats}: <span className="font-semibold">{usage.seatsUsed} / {entitlements.seatsLimit}</span></li>
                  <li>{t.limits.aiPerMonth}: <span className="font-semibold">{usage.aiThisMonth} / {entitlements.aiMonthlyLimit}</span></li>
                  <li>{t.limits.pdfPerMonth}: <span className="font-semibold">{usage.pdfThisMonth} / {entitlements.pdfMonthlyLimit}</span></li>
                </ul>
              </div>
            </div>

            <a
              href="#plan-i-limity"
              className="inline-flex h-9 items-center justify-center rounded-xl border border-border bg-surface2 px-3 text-sm font-medium text-text"
            >
              {t.limits.upgradePlan}
            </a>

            <div className="rounded-xl border border-border bg-surface2 p-3">
              <p className="mb-2 text-sm font-medium text-text">{t.limits.blocksAndReasons}</p>
              <ul className="space-y-1 text-sm text-text">
                <li>
                  AI: <span className="font-semibold">{aiGuard.ok ? t.limits.available : t.limits.blocked}</span>
                  {!aiGuard.ok ? <span className="text-muted"> — {reasonLabel(aiGuard.reason)}</span> : null}
                </li>
                <li>
                  PDF: <span className="font-semibold">{pdfGuard.ok ? t.limits.available : t.limits.blocked}</span>
                  {!pdfGuard.ok ? <span className="text-muted"> — {reasonLabel(pdfGuard.reason)}</span> : null}
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border bg-surface shadow-soft">
          <CardHeader>
            <CardTitle>Kontrola AI</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface2 p-3">
              <span className="text-sm font-medium text-text">AI w projekcie</span>
              <Input
                type="checkbox"
                checked={policies.ai.enabled}
                onChange={(event) => {
                  updateAndSync(workspaceSlug, { ai: { enabled: event.target.checked } }, actor, setPolicies);
                }}
                className="h-5 w-5"
              />
            </label>

            <div className="rounded-xl border border-border bg-surface2 p-3">
              <p className="mb-2 text-sm font-medium text-text">Miesięczny limit użyć AI</p>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100000}
                  value={monthlyLimitInput}
                  onChange={(event) => setMonthlyLimitInput(event.target.value)}
                  onBlur={() => {
                    const parsed = Number(monthlyLimitInput);
                    const normalized = Number.isFinite(parsed) ? Math.floor(parsed) : policies.ai.monthlyLimit;
                    updateAndSync(workspaceSlug, { ai: { monthlyLimit: normalized } }, actor, (next) => {
                      setPolicies(next);
                      setMonthlyLimitInput(String(next.ai.monthlyLimit));
                    });
                  }}
                  className="w-40"
                />
                <Badge className={statusTone}>{statusLabel}</Badge>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface2 p-3">
              <p className="text-sm text-text">
                Wykorzystanie w tym miesiącu: <span className="font-semibold">{policies.ai.usageThisMonth} / {policies.ai.monthlyLimit}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border bg-surface shadow-soft">
          <CardHeader>
            <CardTitle>Governance publikacji</CardTitle>
          </CardHeader>
          <CardContent>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface2 p-3">
              <span className="text-sm font-medium text-text">Wymagaj akceptacji przed publikacją</span>
              <Input
                type="checkbox"
                checked={policies.publishing.requireApproval}
                onChange={(event) => {
                  updateAndSync(workspaceSlug, { publishing: { requireApproval: event.target.checked } }, actor, setPolicies);
                }}
                className="h-5 w-5"
              />
            </label>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border bg-surface shadow-soft">
          <CardHeader>
            <CardTitle>Metadane polityk</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-text">Ostatnia zmiana: <span className="font-medium">{formatDateLabel(policies.audit.lastChangedAt)}</span></p>
            <p className="text-sm text-text">Zmienił(a): <span className="font-medium">{policies.audit.lastChangedBy ?? "—"}</span></p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border bg-surface shadow-soft">
          <CardHeader>
            <CardTitle>Audit (Lite)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {visibleEntries.length === 0 ? (
              <p className="rounded-xl border border-border bg-surface2 p-3 text-sm text-muted">Brak wpisów audytu polityk.</p>
            ) : (
              <div className="space-y-2">
                {visibleEntries.map((entry, index) => (
                  <div key={`${entry.timestampISO}-${entry.actor}-${index}`} className="rounded-xl border border-border bg-surface2 p-3">
                    <p className="text-xs text-muted">{formatDateLabel(entry.timestampISO)} • {entry.actor}</p>
                    <ul className="mt-1 space-y-1">
                      {entry.changes.slice(0, 3).map((change) => (
                        <li key={change} className="text-sm text-text">{change}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {policies.policyAudit.length > 10 ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowFullHistory((value) => !value)}
              >
                {showFullHistory ? "Ukryj" : "Pokaż więcej"}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
