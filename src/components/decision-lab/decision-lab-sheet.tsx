"use client";

import { useEffect, useMemo, useState } from "react";

import { decisionCopy } from "@/components/decision-intelligence/decision-copy";
import {
  adoptDecisionWithBaseline,
  addExploredDecision,
  loadDecisionStore,
  transitionDecisionStatus,
} from "@/components/decision-timeline/decision-storage";
import type { DecisionEntry, MetricSnapshot } from "@/components/decision-timeline/decision-types";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { intelligenceCopy } from "@/components/intelligence/intelligence-copy";
import { MetricExplainer } from "@/components/intelligence/metric-explainer";
import {
  type FlowMetricsSnapshot,
  type Scenario,
  type PredictOutput,
  runSimulation,
  type SimResult,
  type WorkflowPolicy,
  type WorkflowSignals,
  type WorkflowStageId,
} from "@/lib/workflow";
import {
  type DecisionLabVisibilityValue,
  type RunListItem,
  type ScenarioListItem,
} from "@/lib/decision-lab/types";

import { decisionLabCopy } from "./decision-lab-copy";
import { createRun, createScenario, fetchRun, fetchRuns, fetchScenarios } from "./decision-lab-api";
import { buildSimInputFromContentState } from "./decision-lab-mappers";
import { buildDecisionLabPresets } from "./decision-lab-presets";
import {
  applyOverridesToScenario,
  DEFAULT_OVERRIDES,
  deriveContextStages,
  type DecisionLabKnobOverrides,
  type DecisionLabRun,
} from "./decision-lab-state";
import {
  applyDecisionLabUrlState,
  decodeDecisionLabState,
  decodeDecisionLabUrlState,
  encodeDecisionLabState,
} from "./decision-lab-url";
import {
  EmptyStatePanel,
  MetricRow,
  SectionHeader,
  StageHotspotsTable,
  TinyImpactBar,
} from "./decision-lab-ui";

type DecisionLabSheetProps = {
  workspaceSlug: string;
  policy?: WorkflowPolicy;
  workflowSignals?: WorkflowSignals;
  flowMetrics?: FlowMetricsSnapshot;
  predictiveRisk?: PredictOutput;
  items: Array<{ stageId: WorkflowStageId }>;
};

function toRunResult(input: RunListItem): SimResult {
  return {
    scenarioId: input.scenarioId ?? input.id,
    scenarioName: input.scenarioNameSnapshot,
    horizonDays: input.horizonDays,
    baseline: input.result.baseline,
    projected: input.result.projected,
    delta: input.result.delta,
    stages: input.result.stages,
    attribution: input.result.attribution,
    notes: input.result.notes,
  };
}

function toDecisionLabRun(input: RunListItem): DecisionLabRun {
  return {
    id: `remote_${input.id}`,
    timestampMs: new Date(input.createdAt).getTime(),
    scenarioId: input.scenarioId,
    scenarioName: input.scenarioNameSnapshot,
    result: toRunResult(input),
    persistedRunId: input.id,
    source: "remote",
  };
}

function formatTime(timestampMs: number): string {
  const date = new Date(timestampMs);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

function explain(delta: {
  throughputPerWeekDelta: number;
  leadAvgHoursDelta: number;
  bottleneckIndexDelta: number;
}): string {
  if (delta.throughputPerWeekDelta > 0.2 && delta.leadAvgHoursDelta < -4 && delta.bottleneckIndexDelta <= 0) {
    return decisionLabCopy.interpretationGood;
  }
  if (delta.throughputPerWeekDelta >= 0 && delta.leadAvgHoursDelta > 0) {
    return decisionLabCopy.interpretationMixed;
  }
  if (delta.throughputPerWeekDelta < 0 && delta.bottleneckIndexDelta > 0) {
    return decisionLabCopy.interpretationWorse;
  }
  return decisionLabCopy.interpretationNeutral;
}

function safeDelta(projected?: number, baseline?: number): number | undefined {
  if (typeof projected !== "number" || typeof baseline !== "number") {
    return undefined;
  }
  return projected - baseline;
}

function safeMetric(value: number | undefined): number | undefined {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

export function DecisionLabSheet(props: DecisionLabSheetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "fallback">("idle");
  const [copyFallbackUrl, setCopyFallbackUrl] = useState("");
  const [overrides, setOverrides] = useState<DecisionLabKnobOverrides>(DEFAULT_OVERRIDES);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [history, setHistory] = useState<DecisionLabRun[]>([]);
  const [selectedCompareRunId, setSelectedCompareRunId] = useState<string | null>(null);
  const [savedScenarios, setSavedScenarios] = useState<ScenarioListItem[]>([]);
  const [savedRuns, setSavedRuns] = useState<RunListItem[]>([]);
  const [selectedSavedScenarioId, setSelectedSavedScenarioId] = useState<string | null>(null);
  const [manualScenario, setManualScenario] = useState<Scenario | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSavingScenario, setIsSavingScenario] = useState(false);
  const [showSaveScenarioForm, setShowSaveScenarioForm] = useState(false);
  const [scenarioSaveName, setScenarioSaveName] = useState("");
  const [scenarioSaveVisibility, setScenarioSaveVisibility] = useState<DecisionLabVisibilityValue>("WORKSPACE");
  const [latestDecisionEntryId, setLatestDecisionEntryId] = useState<string | null>(null);

  const mapperForCounts = useMemo(
    () =>
      buildSimInputFromContentState({
        policy: props.policy,
        signals: props.workflowSignals,
        items: props.items,
        flowMetrics: props.flowMetrics,
        predictiveRisk: props.predictiveRisk,
      }),
    [props.flowMetrics, props.items, props.policy, props.predictiveRisk, props.workflowSignals],
  );

  const contextStages = useMemo(
    () =>
      deriveContextStages({
        policy: props.policy,
        signals: props.workflowSignals,
        byStageCount: mapperForCounts.byStageCount,
      }),
    [mapperForCounts.byStageCount, props.policy, props.workflowSignals],
  );

  const presets = useMemo(
    () =>
      buildDecisionLabPresets({
        policy: props.policy,
        context: contextStages,
        byStageCount: mapperForCounts.byStageCount,
      }),
    [contextStages, mapperForCounts.byStageCount, props.policy],
  );

  useEffect(() => {
    if (!selectedPresetId && presets.length > 0) {
      setSelectedPresetId(presets[0].id);
    }
  }, [presets, selectedPresetId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onEscape);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || presets.length === 0) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const decodedUrlState = decodeDecisionLabUrlState(params);

    if (decodedUrlState.encodedState) {
      const decoded = decodeDecisionLabState(decodedUrlState.encodedState);
      if (decoded && presets.some((preset) => preset.id === decoded.presetId)) {
        setSelectedPresetId(decoded.presetId);
        setOverrides(decoded.knobsOverrides);
      }
    }

    if (!decodedUrlState.runId) {
      return;
    }

    void fetchRun(props.workspaceSlug, decodedUrlState.runId)
      .then((run) => {
        const mapped = toDecisionLabRun(run);
        setHistory((prev) => {
          const filtered = prev.filter((entry) => entry.persistedRunId !== run.id);
          return [mapped, ...filtered].slice(0, 10);
        });
      })
      .catch(() => {
        setApiError("Could not load shared run.");
      });
  }, [isOpen, presets, props.workspaceSlug]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    void (async () => {
      try {
        setApiError(null);
        const [scenarios, runs] = await Promise.all([
          fetchScenarios(props.workspaceSlug),
          fetchRuns(props.workspaceSlug, selectedSavedScenarioId ?? undefined),
        ]);

        setSavedScenarios(scenarios.slice(0, 8));
        setSavedRuns(runs.slice(0, 10));
        if (runs.length > 0) {
          setHistory((prev) => {
            const merged = [...prev];
            for (const run of runs.slice(0, 10)) {
              const mapped = toDecisionLabRun(run);
              if (!merged.some((entry) => entry.persistedRunId === run.id)) {
                merged.push(mapped);
              }
            }
            return merged
              .sort((left, right) => right.timestampMs - left.timestampMs)
              .slice(0, 10);
          });
        }
      } catch {
        setApiError("Could not load saved scenarios or runs.");
      }
    })();
  }, [isOpen, props.workspaceSlug, selectedSavedScenarioId]);

  const selectedPreset = useMemo(
    () => presets.find((preset) => preset.id === selectedPresetId) ?? presets[0],
    [presets, selectedPresetId],
  );

  const selectedScenario = useMemo(() => {
    if (manualScenario) {
      return manualScenario;
    }
    if (!selectedPreset) {
      return null;
    }
    return applyOverridesToScenario(selectedPreset.scenario, overrides);
  }, [manualScenario, overrides, selectedPreset]);

  const latestRun = history[0];
  const compareRun = selectedCompareRunId ? history.find((run) => run.id === selectedCompareRunId) : null;

  const selectedSavedScenario = useMemo(
    () => savedScenarios.find((scenario) => scenario.id === selectedSavedScenarioId) ?? null,
    [savedScenarios, selectedSavedScenarioId],
  );

  const latestRunScenarioMatch = useMemo(
    () => (latestRun?.scenarioId ? savedScenarios.find((scenario) => scenario.id === latestRun.scenarioId) ?? null : null),
    [latestRun?.scenarioId, savedScenarios],
  );

  const readiness = useMemo(
    () =>
      buildSimInputFromContentState({
        policy: props.policy,
        signals: props.workflowSignals,
        items: props.items,
        flowMetrics: props.flowMetrics,
        predictiveRisk: props.predictiveRisk,
        scenario: selectedScenario ?? undefined,
      }),
    [props.flowMetrics, props.items, props.policy, props.predictiveRisk, props.workflowSignals, selectedScenario],
  );

  const sortedHotspots = useMemo(() => {
    if (!latestRun) {
      return [];
    }
    return [...latestRun.result.stages]
      .sort((left, right) => {
        const leftMagnitude = Math.abs(left.delta.effectiveCapacityDelta) + Math.abs(left.delta.wipPressureDelta) * 0.3;
        const rightMagnitude = Math.abs(right.delta.effectiveCapacityDelta) + Math.abs(right.delta.wipPressureDelta) * 0.3;
        if (rightMagnitude !== leftMagnitude) {
          return rightMagnitude - leftMagnitude;
        }
        return left.stageId.localeCompare(right.stageId);
      })
      .slice(0, 5);
  }, [latestRun]);

  const topAttribution = useMemo(() => {
    if (!latestRun) {
      return [];
    }
    return [...latestRun.result.attribution]
      .sort((left, right) => {
        if (right.impactScore !== left.impactScore) {
          return right.impactScore - left.impactScore;
        }
        return left.driver.localeCompare(right.driver);
      })
      .slice(0, 3);
  }, [latestRun]);

  const latestInterpretation = latestRun
    ? explain({
        throughputPerWeekDelta: latestRun.result.delta.throughputPerWeekDelta,
        leadAvgHoursDelta: latestRun.result.delta.leadAvgHoursDelta,
        bottleneckIndexDelta: latestRun.result.delta.bottleneckIndexDelta,
      })
    : "";

  useEffect(() => {
    if (!latestRun) {
      setLatestDecisionEntryId(null);
      return;
    }

    try {
      const store = loadDecisionStore(props.workspaceSlug);
      const matched = store.entries.find(
        (entry) => entry.scenarioName === latestRun.scenarioName && entry.horizonDays === latestRun.result.horizonDays,
      );
      setLatestDecisionEntryId(matched?.id ?? null);
    } catch {
      setLatestDecisionEntryId(null);
    }
  }, [latestRun, props.workspaceSlug]);

  function emitDecisionUpdated(): void {
    window.dispatchEvent(new CustomEvent("cct:decision:updated"));
  }

  function createDecisionEntryFromRun(run: DecisionLabRun): DecisionEntry {
    const generatedId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${run.id}_${run.timestampMs}`;

    return {
      id: generatedId,
      scenarioId: run.scenarioId,
      scenarioName: run.scenarioName,
      horizonDays: run.result.horizonDays,
      delta: {
        throughputDelta: safeDelta(run.result.projected.throughputPerWeek, run.result.baseline.throughputPerWeek),
        leadTimeDelta: safeDelta(run.result.projected.leadAvgHours, run.result.baseline.leadAvgHours),
        riskDelta: safeDelta(run.result.projected.predictivePressure, run.result.baseline.predictivePressure),
      },
      status: "explored",
      createdAt: new Date(run.timestampMs).toISOString(),
    };
  }

  function adoptLatestDecision(): void {
    if (!latestDecisionEntryId || !latestRun) {
      return;
    }

    try {
      const baselineSnapshot: MetricSnapshot = {
        capturedAt: new Date().toISOString(),
        windowDays: 7,
        throughputPerWeek: safeMetric(latestRun.result.baseline.throughputPerWeek),
        leadAvgHours: safeMetric(latestRun.result.baseline.leadAvgHours),
        cycleAvgHours: safeMetric(latestRun.result.baseline.cycleAvgHours),
        bottleneckIndex: safeMetric(latestRun.result.baseline.bottleneckIndex),
        predictivePressure: safeMetric(latestRun.result.baseline.predictivePressure),
      };

      adoptDecisionWithBaseline(props.workspaceSlug, latestDecisionEntryId, baselineSnapshot);
      emitDecisionUpdated();
      setIsOpen(false);
    } catch {
      return;
    }
  }

  function rejectLatestDecision(): void {
    if (!latestDecisionEntryId) {
      return;
    }

    try {
      transitionDecisionStatus(props.workspaceSlug, latestDecisionEntryId, "rejected");
      emitDecisionUpdated();
    } catch {
      return;
    }
  }

  const runSimulationNow = () => {
    const simInput = readiness.simInput;

    if (!selectedScenario || readiness.status !== "ready" || !simInput) {
      return;
    }

    setRunError(null);
    setIsRunning(true);

    window.setTimeout(() => {
      try {
        const result = runSimulation(simInput);
        const localRun: DecisionLabRun = {
          id: `${Date.now()}_${result.scenarioId}`,
          timestampMs: Date.now(),
          scenarioId: result.scenarioId,
          scenarioName: result.scenarioName,
          result,
          source: "local",
        };

        setHistory((prev) => [localRun, ...prev].slice(0, 10));

        try {
          const updatedStore = addExploredDecision(props.workspaceSlug, createDecisionEntryFromRun(localRun));
          setLatestDecisionEntryId(updatedStore.entries[0]?.id ?? null);
          emitDecisionUpdated();
        } catch {
          setLatestDecisionEntryId(null);
        }

        void createRun(props.workspaceSlug, {
          scenarioId: selectedSavedScenario?.id,
          scenarioNameSnapshot: result.scenarioName.slice(0, 80),
          horizonDays: result.horizonDays,
          inputSummary: {
            byStageCount: mapperForCounts.byStageCount,
            flags: {
              hasSignals: Boolean(props.workflowSignals),
              hasMetrics: Boolean(props.flowMetrics),
              hasPredict: Boolean(props.predictiveRisk),
            },
          },
          result,
        })
          .then((persisted) => {
            setSavedRuns((prev) => [persisted, ...prev.filter((entry) => entry.id !== persisted.id)].slice(0, 10));
            setHistory((prev) =>
              prev.map((entry) =>
                entry.id === localRun.id
                  ? {
                      ...entry,
                      persistedRunId: persisted.id,
                    }
                  : entry,
              ),
            );
          })
          .catch(() => {
            setApiError("Run saved locally only. Backend persistence failed.");
          });
      } catch {
        setRunError(decisionLabCopy.runError);
      } finally {
        setIsRunning(false);
      }
    }, 0);
  };

  const resetState = () => {
    setOverrides(DEFAULT_OVERRIDES);
    setManualScenario(null);
    setSelectedSavedScenarioId(null);
    if (presets[0]) {
      setSelectedPresetId(presets[0].id);
    }
    setRunError(null);
    setCopyFallbackUrl("");
    setCopyState("idle");
  };

  const copyLink = async () => {
    const encodedState = encodeDecisionLabState({
      presetId: selectedPreset?.id ?? "",
      knobsOverrides: overrides,
    });

    const latestPersistedRunId = latestRun?.persistedRunId;
    const fullUrl = applyDecisionLabUrlState(new URL(window.location.href), {
      encodedState,
      runId: latestPersistedRunId,
    });

    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopyFallbackUrl("");
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1200);
    } catch {
      setCopyFallbackUrl(fullUrl);
      setCopyState("fallback");
    }
  };

  const applySavedScenario = (scenario: ScenarioListItem) => {
    setManualScenario({
      id: scenario.id,
      name: scenario.name,
      horizon: { days: scenario.horizonDays },
      knobs: scenario.knobs,
    });
    setSelectedSavedScenarioId(scenario.id);
    setApiError(null);
  };

  const persistCurrentScenario = async () => {
    if (!selectedScenario || scenarioSaveName.trim().length === 0) {
      setApiError("Scenario name is required.");
      return;
    }

    setIsSavingScenario(true);
    setApiError(null);

    try {
      const created = await createScenario(props.workspaceSlug, {
        name: scenarioSaveName.trim().slice(0, 80),
        description: undefined,
        visibility: scenarioSaveVisibility,
        horizonDays: Math.max(7, Math.min(60, Math.round(selectedScenario.horizon?.days ?? 14))),
        knobs: selectedScenario.knobs,
      });

      setSavedScenarios((prev) => [created, ...prev.filter((entry) => entry.id !== created.id)].slice(0, 8));
      setSelectedSavedScenarioId(created.id);
      setShowSaveScenarioForm(false);
      setScenarioSaveName("");
      setScenarioSaveVisibility("WORKSPACE");
    } catch {
      setApiError("Saving scenario failed.");
    } finally {
      setIsSavingScenario(false);
    }
  };

  const compareRows =
    latestRun && compareRun
      ? [
          {
            key: "throughput",
            label: "Throughput/week",
            latest: latestRun.result.delta.throughputPerWeekDelta,
            compare: compareRun.result.delta.throughputPerWeekDelta,
            goodWhenPositive: true,
          },
          {
            key: "lead",
            label: "Lead time (h)",
            latest: latestRun.result.delta.leadAvgHoursDelta,
            compare: compareRun.result.delta.leadAvgHoursDelta,
            goodWhenPositive: false,
          },
          {
            key: "bottleneck",
            label: "Bottleneck index",
            latest: latestRun.result.delta.bottleneckIndexDelta,
            compare: compareRun.result.delta.bottleneckIndexDelta,
            goodWhenPositive: false,
          },
        ]
      : [];

  return (
    <>
      <div className="inline-flex items-center gap-2" data-cct="decision-lab-trigger">
        <Button variant="secondary" size="sm" onClick={() => setIsOpen(true)} data-cct="decision-lab-trigger">
          <span className="inline-flex items-center gap-1">
            <span>{decisionLabCopy.triggerTitle}</span>
            <span className="rounded-full bg-surface2 px-1.5 py-0.5 text-[10px] text-textMuted">{decisionLabCopy.triggerHint}</span>
          </span>
        </Button>
        <MetricExplainer id="decision-lab-trigger" label="Decision Lab trigger help" lines={intelligenceCopy.metrics.decisionLab} />
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close Decision Lab"
            className="absolute inset-0 bg-text/20"
            onClick={() => setIsOpen(false)}
          />

          <aside className="absolute right-0 top-0 h-full w-full max-w-[560px] overflow-y-auto border-l border-border bg-surface p-4 shadow-soft">
            <div className="mb-4 flex items-start justify-between">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-text">{decisionLabCopy.title}</h2>
                  <MetricExplainer id="decision-lab-header" label="Decision Lab header help" lines={intelligenceCopy.metrics.decisionLab} />
                </div>
                <p className="text-sm text-textMuted">{decisionLabCopy.subtitle}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
                Close
              </Button>
            </div>

            <div className="space-y-4">
              <details open>
                <summary className="cursor-pointer list-none">
                  <SectionHeader title={decisionLabCopy.sectionScenario} />
                </summary>

                <Card>
                  <CardContent className="space-y-3 pt-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-medium text-text">Saved scenarios</label>
                        <Button variant="ghost" size="sm" onClick={() => setShowSaveScenarioForm((prev) => !prev)}>
                          Save scenario
                        </Button>
                      </div>

                      {savedScenarios.length === 0 ? (
                        <p className="rounded-lg border border-border bg-surface2/70 px-3 py-2 text-xs text-textMuted">No saved scenarios yet.</p>
                      ) : (
                        <div className="space-y-1">
                          {savedScenarios.slice(0, 8).map((scenario) => (
                            <button
                              key={scenario.id}
                              type="button"
                              className={`w-full rounded-lg border px-3 py-2 text-left text-xs ${
                                selectedSavedScenarioId === scenario.id
                                  ? "border-primary/40 bg-primarySoft text-text"
                                  : "border-border bg-surface2/70 text-textMuted"
                              }`}
                              onClick={() => applySavedScenario(scenario)}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{scenario.name}</span>
                                <span>{scenario.visibility}</span>
                              </div>
                              <div className="mt-1 text-[11px]">Horizon {scenario.horizonDays}d · Runs {scenario.runCount}</div>
                            </button>
                          ))}
                        </div>
                      )}

                      {showSaveScenarioForm ? (
                        <div className="space-y-2 rounded-lg border border-border bg-surface2/70 px-3 py-2">
                          <input
                            aria-label="Scenario name"
                            className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs text-text"
                            placeholder="Scenario name"
                            value={scenarioSaveName}
                            onChange={(event) => setScenarioSaveName(event.target.value)}
                          />
                          <select
                            aria-label="Scenario visibility"
                            className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs text-text"
                            value={scenarioSaveVisibility}
                            onChange={(event) => setScenarioSaveVisibility(event.target.value as DecisionLabVisibilityValue)}
                          >
                            <option value="WORKSPACE">WORKSPACE</option>
                            <option value="PRIVATE">PRIVATE</option>
                          </select>
                          <div>
                            <Button variant="secondary" size="sm" disabled={isSavingScenario} onClick={() => void persistCurrentScenario()}>
                              {isSavingScenario ? "Saving…" : "Save"}
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <label className="block text-xs font-medium text-text">Preset</label>
                    <select
                      aria-label="Decision Lab preset"
                      data-cct="dl-presets"
                      className="h-10 w-full rounded-xl border border-border bg-surface2 px-3 text-sm text-text"
                      value={selectedPreset?.id ?? ""}
                      onChange={(event) => {
                        setManualScenario(null);
                        setSelectedSavedScenarioId(null);
                        setSelectedPresetId(event.target.value);
                      }}
                    >
                      {presets.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-textMuted">{selectedPreset?.description ?? ""}</p>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs text-textMuted">Capacity</label>
                        <select
                          aria-label="Capacity adjustment"
                          className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs text-text"
                          value={overrides.capacityAdjustPct}
                          onChange={(event) =>
                            setOverrides((prev) => ({
                              ...prev,
                              capacityAdjustPct: Number(event.target.value) as DecisionLabKnobOverrides["capacityAdjustPct"],
                            }))
                          }
                        >
                          <option value={-20}>-20%</option>
                          <option value={0}>No change</option>
                          <option value={10}>+10%</option>
                          <option value={20}>+20%</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs text-textMuted">WIP limit</label>
                        <select
                          aria-label="WIP adjustment"
                          className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs text-text"
                          value={overrides.wipAdjust}
                          onChange={(event) =>
                            setOverrides((prev) => ({
                              ...prev,
                              wipAdjust: Number(event.target.value) as DecisionLabKnobOverrides["wipAdjust"],
                            }))
                          }
                        >
                          <option value={-1}>-1</option>
                          <option value={0}>No change</option>
                          <option value={1}>+1</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs text-textMuted">Influx</label>
                        <select
                          aria-label="Influx adjustment"
                          className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs text-text"
                          value={overrides.influxAdd}
                          onChange={(event) =>
                            setOverrides((prev) => ({
                              ...prev,
                              influxAdd: Number(event.target.value) as DecisionLabKnobOverrides["influxAdd"],
                            }))
                          }
                        >
                          <option value={0}>+0</option>
                          <option value={5}>+5</option>
                          <option value={10}>+10</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs text-textMuted">Outage days</label>
                        <select
                          aria-label="Outage days adjustment"
                          className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs text-text"
                          value={overrides.outageDays}
                          onChange={(event) =>
                            setOverrides((prev) => ({
                              ...prev,
                              outageDays: Number(event.target.value) as DecisionLabKnobOverrides["outageDays"],
                            }))
                          }
                        >
                          <option value={0}>0</option>
                          <option value={2}>2</option>
                          <option value={3}>3</option>
                        </select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </details>

              <details open>
                <summary className="cursor-pointer list-none">
                  <SectionHeader title={decisionLabCopy.sectionRun} />
                </summary>

                <Card>
                  <CardContent className="space-y-3 pt-4">
                    {apiError ? <p className="text-xs text-danger">{apiError}</p> : null}
                    <div className="rounded-lg border border-border bg-surface2/70 px-3 py-2 text-xs text-textMuted">
                      Data status: {readiness.status === "ready" ? decisionLabCopy.ready : decisionLabCopy.notReady}
                      {readiness.status === "insufficient" ? (
                        <ul className="mt-1 list-disc pl-4">
                          {readiness.reasons.slice(0, 3).map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={isRunning || readiness.status !== "ready"}
                        onClick={runSimulationNow}
                      >
                        {isRunning ? decisionLabCopy.running : decisionLabCopy.run}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={resetState}>
                        {decisionLabCopy.reset}
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => void copyLink()}>
                        {decisionLabCopy.copyLink}
                      </Button>
                    </div>

                    {copyState === "copied" ? <p className="text-xs text-primary">{decisionLabCopy.copied}</p> : null}
                    {copyState === "fallback" ? (
                      <div className="space-y-1">
                        <p className="text-xs text-textMuted">{decisionLabCopy.copyFallback}</p>
                        <input
                          aria-label="Decision Lab share link"
                          title="Decision Lab share link"
                          placeholder="Decision Lab share link"
                          className="h-9 w-full rounded-lg border border-border bg-surface2 px-2 text-xs text-text"
                          readOnly
                          value={copyFallbackUrl}
                        />
                      </div>
                    ) : null}

                    {runError ? <p className="text-xs text-danger">{runError}</p> : null}
                    {latestRun ? (
                      <p className="text-xs text-textMuted">
                        {decisionLabCopy.lastRunPrefix} {formatTime(latestRun.timestampMs)}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              </details>

              <details open>
                <summary className="cursor-pointer list-none">
                  <SectionHeader title={decisionLabCopy.sectionResults} />
                </summary>

                {!latestRun ? (
                  <EmptyStatePanel text={decisionLabCopy.noResults} />
                ) : (
                  <div className="space-y-3">
                    {latestRun.source === "remote" ? (
                      <Card>
                        <CardContent className="space-y-2 pt-4">
                          <p className="text-xs text-textMuted">Viewing shared run in read-only mode.</p>
                          <div>
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={!latestRunScenarioMatch}
                              onClick={() => {
                                if (latestRunScenarioMatch) {
                                  applySavedScenario(latestRunScenarioMatch);
                                }
                              }}
                            >
                              Load into lab
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ) : null}

                    {latestDecisionEntryId ? (
                      <Card>
                        <CardContent className="flex flex-wrap items-center gap-2 pt-4">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="border-success/30 bg-success/15 text-success hover:bg-success/20"
                            onClick={adoptLatestDecision}
                          >
                            {decisionCopy.adopt}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={rejectLatestDecision}>
                            {decisionCopy.reject}
                          </Button>
                        </CardContent>
                      </Card>
                    ) : null}

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Baseline vs projected</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr_auto] px-3 text-[11px] uppercase tracking-wide text-textMuted">
                          <span>Metric</span>
                          <span className="text-right">Baseline</span>
                          <span className="text-right">Projected</span>
                          <span className="text-right">Δ</span>
                        </div>

                        <MetricRow
                          label="Throughput/week"
                          baseline={latestRun.result.baseline.throughputPerWeek}
                          projected={latestRun.result.projected.throughputPerWeek}
                          delta={latestRun.result.delta.throughputPerWeekDelta}
                          goodWhenPositive
                        />
                        <MetricRow
                          label="Lead time (h)"
                          baseline={latestRun.result.baseline.leadAvgHours}
                          projected={latestRun.result.projected.leadAvgHours}
                          delta={latestRun.result.delta.leadAvgHoursDelta}
                          goodWhenPositive={false}
                        />
                        <MetricRow
                          label="Cycle time (h)"
                          baseline={latestRun.result.baseline.cycleAvgHours}
                          projected={latestRun.result.projected.cycleAvgHours}
                          delta={latestRun.result.delta.cycleAvgHoursDelta}
                          goodWhenPositive={false}
                        />
                        <MetricRow
                          label="Bottleneck index"
                          baseline={latestRun.result.baseline.bottleneckIndex}
                          projected={latestRun.result.projected.bottleneckIndex}
                          delta={latestRun.result.delta.bottleneckIndexDelta}
                          goodWhenPositive={false}
                        />
                        <MetricRow
                          label="Predictive pressure"
                          baseline={latestRun.result.baseline.predictivePressure}
                          projected={latestRun.result.projected.predictivePressure}
                          delta={latestRun.result.delta.predictivePressureDelta}
                          goodWhenPositive={false}
                        />
                        <MetricRow
                          label="Critical items"
                          baseline={latestRun.result.baseline.predictiveCriticalCount}
                          projected={latestRun.result.projected.predictiveCriticalCount}
                          delta={latestRun.result.delta.predictiveCriticalCountDelta}
                          goodWhenPositive={false}
                        />
                        <MetricRow
                          label="ETA p90 (days)"
                          baseline={latestRun.result.baseline.etaP90Days}
                          projected={latestRun.result.projected.etaP90Days}
                          delta={latestRun.result.delta.etaP90DaysDelta}
                          goodWhenPositive={false}
                        />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Top attribution</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {topAttribution.map((entry) => (
                            <div key={`${entry.driver}_${entry.stageId ?? "global"}`} className="space-y-1 rounded-lg border border-border bg-surface2/70 px-3 py-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-text">
                                {entry.driver}
                                {entry.stageId ? ` · ${entry.stageId}` : ""}
                              </span>
                              <span className="text-textMuted">impact {entry.impactScore.toFixed(2)}</span>
                            </div>
                            <TinyImpactBar value={Math.min(100, entry.impactScore * 100)} />
                            <p className="text-xs text-textMuted">{entry.note}</p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <StageHotspotsTable stages={sortedHotspots} />

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Interpretation</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-textMuted">{latestInterpretation}</p>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </details>

              <details open>
                <summary className="cursor-pointer list-none">
                  <SectionHeader title={decisionLabCopy.sectionHistory} />
                </summary>

                {history.length === 0 ? (
                  <EmptyStatePanel text={decisionLabCopy.noHistory} />
                ) : (
                  <div className="space-y-3">
                    <Card>
                      <CardContent className="space-y-2 pt-4">
                        {history.map((run) => {
                          const selected = run.id === selectedCompareRunId;
                          return (
                            <div key={run.id} className="flex items-center justify-between rounded-lg border border-border bg-surface2/70 px-3 py-2">
                              <div>
                                <p className="text-xs font-medium text-text">{run.scenarioName}</p>
                                <p className="text-[11px] text-textMuted">{formatTime(run.timestampMs)}</p>
                              </div>
                              <Button
                                variant={selected ? "primary" : "ghost"}
                                size="sm"
                                onClick={() => setSelectedCompareRunId(selected ? null : run.id)}
                              >
                                {selected ? "Selected" : "Compare"}
                              </Button>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>

                    {latestRun && compareRun ? (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">{decisionLabCopy.compareMode}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {compareRows.map((row) => {
                            const diff = row.latest - row.compare;
                            return (
                              <div key={row.key} className="flex items-center justify-between rounded-lg border border-border bg-surface2/70 px-3 py-2 text-xs">
                                <span className="font-medium text-text">{row.label}</span>
                                <span className="text-textMuted">
                                  latest {row.latest.toFixed(2)} vs selected {row.compare.toFixed(2)}
                                </span>
                                <span className="text-text">Δ {diff > 0 ? "+" : ""}{diff.toFixed(2)}</span>
                              </div>
                            );
                          })}
                        </CardContent>
                      </Card>
                    ) : null}
                  </div>
                )}
              </details>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
