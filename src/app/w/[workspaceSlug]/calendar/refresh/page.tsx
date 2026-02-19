import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { FeatureLockCard } from "@/components/billing/FeatureLockCard";
import { PlanBadge } from "@/components/billing/PlanBadge";
import { TokenPill } from "@/components/billing/TokenPill";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { RefreshGuidance } from "@/app/w/[workspaceSlug]/calendar/refresh/_components/refresh-guidance";
import { requireWorkspaceAccess } from "@/lib/auth/workspace";
import { sprawdzDostepDoFunkcji } from "@/lib/billing/featureAccess";
import type { PlanId } from "@/lib/billing/planConfig";
import { getRecentOutcomes } from "@/lib/domain/controlTowerV3";
import { createRefreshedPlan } from "@/server/actions/plans";
import { getPlan, getPlanRefreshProposal, listPlans } from "@/server/queries/plans";

type PageProps = {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function toValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function parseHorizon(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 8;
  }
  return Math.max(4, Math.min(12, Math.floor(parsed)));
}

function nextMondayInputValue(): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
}

function parseList(value: string, fallback: string[]): string[] {
  const parsed = value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);

  return parsed.length > 0 ? parsed : fallback;
}

function weekKey(value: string): string {
  const date = new Date(value);
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
}

function channelLabel(channel: string): string {
  if (channel === "blog") {
    return "Blog";
  }
  if (channel === "linkedin") {
    return "LinkedIn";
  }
  if (channel === "newsletter") {
    return "Newsletter";
  }
  if (channel === "landing") {
    return "Strona docelowa";
  }
  return channel;
}

type CalendarChannel = "blog" | "linkedin" | "newsletter" | "landing";

type GuidanceMode = "scale_down" | "hold" | "scale_up";

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseOutcomeDetails(details?: string): { estMins?: number; durationSeconds?: number } {
  if (!details) {
    return {};
  }

  try {
    const parsed = JSON.parse(details) as {
      metadata?: { estMins?: number };
      durationSeconds?: number;
    };

    return {
      estMins: typeof parsed.metadata?.estMins === "number" ? parsed.metadata.estMins : undefined,
      durationSeconds: typeof parsed.durationSeconds === "number" ? parsed.durationSeconds : undefined,
    };
  } catch {
    return {};
  }
}

export default async function RefreshPlanPage({ params, searchParams }: PageProps) {
  const { workspaceSlug } = await params;
  const search = await searchParams;

  const selectedPlanId = toValue(search.planId);
  const selectedAssigneeId = toValue(search.assignee) || "all";
  const horizonWeeks = parseHorizon(toValue(search.horizonWeeks) || "8");
  const startDate = toValue(search.startDate) || nextMondayInputValue();
  const cadenceFreq = toValue(search.cadenceFreq) === "biweekly" ? "biweekly" : "weekly";
  const daysOfWeek = parseList(toValue(search.daysOfWeek) || "2,4", ["2", "4"])
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 7);
  const channels = parseList(toValue(search.channels) || "blog,linkedin,newsletter", ["blog", "linkedin", "newsletter"])
    .filter((value): value is CalendarChannel => value === "blog" || value === "linkedin" || value === "newsletter" || value === "landing");
  const shouldGenerate = toValue(search.generate) === "1";
  const message = toValue(search.msg);

  async function generateProposalAction(formData: FormData) {
    "use server";

    const planId = String(formData.get("planId") ?? "");
    const horizon = String(formData.get("horizonWeeks") ?? "8");
    const start = String(formData.get("startDate") ?? nextMondayInputValue());
    const freq = String(formData.get("cadenceFreq") ?? "weekly") === "biweekly" ? "biweekly" : "weekly";

    const days = formData
      .getAll("daysOfWeek")
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= 7)
      .join(",");

    const selectedChannels = formData
      .getAll("channels")
      .map((value) => String(value).toLowerCase())
      .filter((value) => value === "blog" || value === "linkedin" || value === "newsletter" || value === "landing")
      .join(",");

    redirect(
      `/w/${workspaceSlug}/calendar/refresh` +
      `?planId=${encodeURIComponent(planId)}` +
      `&horizonWeeks=${encodeURIComponent(horizon)}` +
      `&startDate=${encodeURIComponent(start)}` +
      `&cadenceFreq=${encodeURIComponent(freq)}` +
      `&daysOfWeek=${encodeURIComponent(days || "2,4")}` +
      `&channels=${encodeURIComponent(selectedChannels || "blog,linkedin,newsletter")}` +
      `&generate=1`,
    );
  }

  async function createRefreshedPlanAction(formData: FormData) {
    "use server";

    const access = await requireWorkspaceAccess(workspaceSlug, "EDITOR");

    const planId = String(formData.get("planId") ?? "");
    const horizon = Number(formData.get("horizonWeeks") ?? 8);
    const start = String(formData.get("startDate") ?? "");
    const freq = String(formData.get("cadenceFreq") ?? "weekly") === "biweekly" ? "biweekly" : "weekly";
    const days = formData
      .getAll("daysOfWeek")
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= 7);
    const selectedChannels = formData
      .getAll("channels")
      .map((value) => String(value).toLowerCase())
      .filter((value) => value === "blog" || value === "linkedin" || value === "newsletter" || value === "landing");

    const result = await createRefreshedPlan(access.workspace.id, {
      planId,
      horizonWeeks: horizon,
      startDateISO: start ? new Date(start).toISOString() : undefined,
      cadenceOverride: {
        freq,
        daysOfWeek: days,
      },
      channelsOverride: selectedChannels,
    });

    if (!result.ok) {
      redirect(
        `/w/${workspaceSlug}/calendar/refresh` +
        `?planId=${encodeURIComponent(planId)}` +
        `&horizonWeeks=${encodeURIComponent(String(horizon))}` +
        `&startDate=${encodeURIComponent(start)}` +
        `&cadenceFreq=${encodeURIComponent(freq)}` +
        `&daysOfWeek=${encodeURIComponent(days.join(",") || "2,4")}` +
        `&channels=${encodeURIComponent(selectedChannels.join(",") || "blog,linkedin,newsletter")}` +
        `&generate=1` +
        `&msg=${encodeURIComponent(result.error.message)}`,
      );
    }

    redirect(
      `/w/${workspaceSlug}/calendar?planId=${encodeURIComponent(result.data.planId)}` +
      `&msg=${encodeURIComponent("Utworzono odświeżony plan jako szkic. Możesz go przejrzeć i aktywować.")}`,
    );
  }

  try {
    const access = await requireWorkspaceAccess(workspaceSlug, "VIEWER");
    const workspaceId = access.workspace.id;
    const planId: PlanId = "control_tower";
    const tokeny = 1200;
    const tokenState = {
      saldo: tokeny,
      odnowienieISO: new Date(Date.now() + (1000 * 60 * 60 * 24 * 30)).toISOString(),
      planMiesiecznyLimit: 250000 as number | "bez_limitu",
    }; // TODO: podpiąć z docelowego billing

    const accessAiRekomendacje = sprawdzDostepDoFunkcji({
      feature: "ai_rekomendacje_strategiczne",
      planId,
      tokeny,
      czyAkcjaAI: true,
    });
    const plans = await listPlans(access.workspace.id);
    const sourcePlan = selectedPlanId ? await getPlan(selectedPlanId, access.workspace.id) : null;
    const outcomes = await getRecentOutcomes({ workspaceId: access.workspace.id, windowHours: 7 * 24 });

    const proposal = shouldGenerate && selectedPlanId
      ? await getPlanRefreshProposal(access.workspace.id, {
          planId: selectedPlanId,
          horizonWeeks,
          startDateISO: startDate ? new Date(startDate).toISOString() : undefined,
          cadenceOverride: {
            freq: cadenceFreq,
            daysOfWeek,
          },
          channelsOverride: channels,
        })
      : null;

    const groupedWeeks = new Map<string, typeof proposal extends null ? never : NonNullable<typeof proposal>["proposal"]["items"]>();
    if (proposal) {
      for (const item of proposal.proposal.items) {
        const key = weekKey(item.publishDate);
        const current = groupedWeeks.get(key) ?? [];
        current.push(item);
        groupedWeeks.set(key, current);
      }
    }

    const weekEntries = [...groupedWeeks.entries()].sort((left, right) => new Date(left[0]).getTime() - new Date(right[0]).getTime());

    const totalSessions = outcomes.length;
    const completedOutcomes = outcomes.filter((outcome) => outcome.outcome === "completed");
    const abandonedCount = outcomes.filter((outcome) => outcome.outcome === "abandoned").length;
    const abandonedRate = abandonedCount / Math.max(1, totalSessions);
    const completedRate = completedOutcomes.length / Math.max(1, totalSessions);

    let actualMinsTotal = 0;
    let actualCount = 0;
    let estMinsTotal = 0;
    let estCount = 0;

    for (const outcome of completedOutcomes) {
      const details = parseOutcomeDetails(outcome.evidence.details);
      const actualFromCounts = outcome.evidence.changedCounts?.durationSeconds;
      const durationSeconds = typeof actualFromCounts === "number" ? actualFromCounts : details.durationSeconds;
      if (typeof durationSeconds === "number") {
        actualMinsTotal += Math.max(0, durationSeconds) / 60;
        actualCount += 1;
      }

      if (typeof details.estMins === "number") {
        estMinsTotal += Math.max(0, details.estMins);
        estCount += 1;
      }
    }

    const avgActualMins = actualCount > 0 ? actualMinsTotal / actualCount : 0;
    const avgEstMins = estCount > 0 ? estMinsTotal / estCount : 30;
    const overrunRatio = avgActualMins / Math.max(1, avgEstMins);

    const expectedWeeklyCoverage = 2;
    const weeklyCoverageCount = proposal
      ? proposal.diagnostics.totalItems / Math.max(1, horizonWeeks)
      : daysOfWeek.length;
    const coverageRatio = weeklyCoverageCount / expectedWeeklyCoverage;

    const backlogScore = clampScore(abandonedRate * 120);
    const coverageScore = clampScore((1 - Math.min(1, coverageRatio)) * 100);
    const timeScore = clampScore((overrunRatio - 1) * 80);
    const totalPressure = clampScore((0.45 * backlogScore) + (0.35 * timeScore) + (0.2 * coverageScore));

    const guidanceMode: GuidanceMode = (totalPressure >= 70 || abandonedRate > 0.4 || overrunRatio >= 1.3)
      ? "scale_down"
      : (totalPressure <= 34 && completedRate >= 0.8 && overrunRatio <= 1.05)
        ? "scale_up"
        : "hold";

    const reason = guidanceMode === "scale_down"
      ? "Sygnały przeciążenia są wysokie (napięcie/porzucone/overrun). Warto ograniczyć intensywność i skrócić horyzont."
      : guidanceMode === "scale_up"
        ? "Rytm jest stabilny i domknięcia są wysokie. Możesz bezpiecznie zwiększyć intensywność planu."
        : "Parametry są w bezpiecznym zakresie. Utrzymaj bieżący poziom i sprawdź preview przed utworzeniem szkicu.";

    const scaleDownDays = daysOfWeek.length > 1 ? daysOfWeek.slice(0, daysOfWeek.length - 1) : daysOfWeek;
    const scaleUpCandidateDay = [2, 4, 1, 3, 5, 6, 7].find((day) => !daysOfWeek.includes(day));
    const scaleUpDays = scaleUpCandidateDay ? [...daysOfWeek, scaleUpCandidateDay].sort((a, b) => a - b) : daysOfWeek;

    const guidancePreset: {
      horizonWeeks: number;
      cadenceFreq: "weekly" | "biweekly";
      daysOfWeek: number[];
      channels: CalendarChannel[];
    } = guidanceMode === "scale_down"
      ? {
        horizonWeeks: Math.max(4, horizonWeeks - 1),
        cadenceFreq: "biweekly" as const,
        daysOfWeek: scaleDownDays,
        channels,
      }
      : guidanceMode === "scale_up"
        ? {
          horizonWeeks: Math.min(12, horizonWeeks + 1),
          cadenceFreq: "weekly" as const,
          daysOfWeek: scaleUpDays,
          channels,
        }
        : {
          horizonWeeks,
          cadenceFreq,
          daysOfWeek,
          channels,
        };

    return (
      <AppShell title="Odśwież plan" activeHref={`/w/${workspaceSlug}/calendar`} workspaceSlug={workspaceSlug}>
        <PageHeader
          title="Odśwież plan"
          subtitle="System przygotuje nowy plan na podstawie wyników i pokrycia."
          actions={
            <Link
              href={`/w/${workspaceSlug}/calendar${selectedPlanId ? `?planId=${encodeURIComponent(selectedPlanId)}` : ""}`}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-surface2 px-4 text-sm font-medium text-text"
            >
              Wróć do kalendarza
            </Link>
          }
        />

        {message ? <p className="mb-4 rounded-xl border border-border bg-surface2 p-3 text-sm text-muted">{message}</p> : null}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <PlanBadge planId={planId} />
          <TokenPill state={tokenState} />
          {accessAiRekomendacje.status !== "ok" ? <p className="text-xs text-muted">{accessAiRekomendacje.powod}</p> : null}
        </div>

        {accessAiRekomendacje.status === "ok" ? (
          <RefreshGuidance
            workspaceId={workspaceId}
            assigneeId={selectedAssigneeId}
            mode={guidanceMode}
            reason={reason}
            pressure={totalPressure}
            abandonedRatePct={Math.round(abandonedRate * 100)}
            overrunRatio={Number.isFinite(overrunRatio) ? overrunRatio : 0}
            coverageRatio={Number.isFinite(coverageRatio) ? coverageRatio : 0}
            preset={guidancePreset}
          />
        ) : (
          <FeatureLockCard tytulFunkcji="Rekomendacje odświeżenia" access={accessAiRekomendacje} />
        )}

        <Card className="mb-4 rounded-2xl border border-border shadow-soft">
          <CardHeader>
            <CardTitle>Ustawienia odświeżenia</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={generateProposalAction} className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm text-muted">
                <span>Plan źródłowy</span>
                <select
                  id="refresh-planId"
                  name="planId"
                  defaultValue={selectedPlanId}
                  className="h-10 w-full rounded-xl border border-border bg-surface2 px-3 text-sm text-text"
                >
                  <option value="">Wybierz plan</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>{plan.name}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm text-muted">
                <span>Horyzont (tygodnie)</span>
                <select
                  id="refresh-horizonWeeks"
                  name="horizonWeeks"
                  defaultValue={String(horizonWeeks)}
                  className="h-10 w-full rounded-xl border border-border bg-surface2 px-3 text-sm text-text"
                >
                  <option value="8">8</option>
                  <option value="12">12</option>
                </select>
              </label>

              <label className="space-y-1 text-sm text-muted">
                <span>Data startu</span>
                <input
                  id="refresh-startDate"
                  type="date"
                  name="startDate"
                  defaultValue={startDate}
                  className="h-10 w-full rounded-xl border border-border bg-surface2 px-3 text-sm text-text"
                />
              </label>

              <label className="space-y-1 text-sm text-muted">
                <span>Kadencja</span>
                <select
                  id="refresh-cadenceFreq"
                  name="cadenceFreq"
                  defaultValue={cadenceFreq}
                  className="h-10 w-full rounded-xl border border-border bg-surface2 px-3 text-sm text-text"
                >
                  <option value="weekly">Tygodniowa</option>
                  <option value="biweekly">Co 2 tygodnie</option>
                </select>
              </label>

              <div className="space-y-1 text-sm text-muted md:col-span-2">
                <span>Dni publikacji</span>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                    <label key={day} className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface2 px-3 py-2 text-xs text-text">
                      <input type="checkbox" name="daysOfWeek" value={day} defaultChecked={daysOfWeek.includes(day)} />
                      {day}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1 text-sm text-muted md:col-span-2">
                <span>Kanały</span>
                <div className="flex flex-wrap gap-2">
                  {(["blog", "linkedin", "newsletter", "landing"] as const).map((channel) => (
                    <label key={channel} className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface2 px-3 py-2 text-xs text-text">
                      <input type="checkbox" name="channels" value={channel} defaultChecked={channels.includes(channel)} />
                      {channelLabel(channel)}
                    </label>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2">
                <Button type="submit" disabled={accessAiRekomendacje.status !== "ok"}>Generuj propozycję</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {proposal ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Card className="rounded-2xl border border-border shadow-soft">
                <CardContent className="p-4">
                  <p className="text-xs text-muted">Liczba tematów</p>
                  <p className="text-lg font-semibold text-text">{proposal.diagnostics.totalItems}</p>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border border-border shadow-soft">
                <CardContent className="p-4">
                  <p className="text-xs text-muted">Liczba klastrów</p>
                  <p className="text-lg font-semibold text-text">{proposal.diagnostics.clusterStats.length}</p>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border border-border shadow-soft">
                <CardContent className="p-4">
                  <p className="text-xs text-muted">Kolizje uniknięte</p>
                  <p className="text-lg font-semibold text-text">{proposal.diagnostics.collisionsAvoided}</p>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-2xl border border-border shadow-soft">
              <CardHeader>
                <CardTitle>Priorytety klastrów</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {proposal.diagnostics.clusterStats.map((cluster) => (
                  <div key={cluster.clusterId} className="rounded-xl border border-border bg-surface2 p-3">
                    <p className="text-sm font-medium text-text">{cluster.clusterLabel}</p>
                    <p className="text-xs text-muted">
                      Waga: {cluster.weight.toFixed(2)} • Wydajność: {cluster.performanceState} • Pokrycie: {cluster.coverageState}
                    </p>
                    <p className="mt-1 text-xs text-text">{cluster.rationale}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-border shadow-soft">
              <CardHeader>
                <CardTitle>Podgląd tygodniowy</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {weekEntries.map(([weekStart, items]) => (
                  <div key={weekStart} className="rounded-xl border border-border bg-surface2 p-3">
                    <p className="mb-2 text-sm font-medium text-text">Tydzień od {new Date(weekStart).toLocaleDateString("pl-PL")}</p>
                    <div className="space-y-2">
                      {items.map((item) => (
                        <div key={`${item.publishDate}-${item.channel}-${item.title}`} className="rounded-lg border border-border bg-background p-2">
                          <p className="text-sm text-text">{item.title}</p>
                          <p className="text-xs text-muted">
                            {new Date(item.publishDate).toLocaleDateString("pl-PL")} • {channelLabel(item.channel)} • {item.primaryKeyword} • {item.clusterLabel}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-border shadow-soft">
              <CardContent className="p-4">
                <form action={createRefreshedPlanAction} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="planId" value={selectedPlanId} />
                  <input type="hidden" name="horizonWeeks" value={horizonWeeks} />
                  <input type="hidden" name="startDate" value={startDate} />
                  <input type="hidden" name="cadenceFreq" value={cadenceFreq} />
                  {daysOfWeek.map((day) => <input key={`day-${day}`} type="hidden" name="daysOfWeek" value={day} />)}
                  {channels.map((channel) => <input key={`ch-${channel}`} type="hidden" name="channels" value={channel} />)}
                  <Button type="submit">Utwórz odświeżony plan (draft)</Button>
                  {sourcePlan ? <span className="text-xs text-muted">Źródło: {sourcePlan.name}</span> : null}
                </form>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </AppShell>
    );
  } catch {
    notFound();
  }
}
