import type { PortfolioPhase, ExecutivePriorityPlay, StrategicPlayId } from "./types";

type PlaybookDef = Omit<ExecutivePriorityPlay, "priority">;

const PLAYBOOKS: Record<StrategicPlayId, PlaybookDef> = {
  stabilize: {
    id: "stabilize",
    title: "Stabilize",
    whyThisMatters: "Critical health and drift concentration can cascade into broader execution failure.",
    whatWillChange: "Operational volatility is reduced through strict closure and WIP control.",
    actions: [
      "Freeze non-priority work in critical workspaces.",
      "Close open decision loops within 48 hours.",
      "Assign single-thread owner for each critical workspace.",
      "Review blocked actions daily until risk band improves.",
    ],
    expectedOutcome: "Critical ratio declines and near-term execution reliability recovers.",
  },
  realign: {
    id: "realign",
    title: "Realign",
    whyThisMatters: "Low alignment weakens strategic coherence and reduces return on effort.",
    whatWillChange: "Weekly action sets map directly to strategic priorities and measurable outcomes.",
    actions: [
      "Re-state top priority per workspace in one sentence.",
      "Remove actions that do not map to a priority.",
      "Define one measurable success metric for each priority.",
      "Run weekly alignment review with explicit keep/drop decisions.",
    ],
    expectedOutcome: "Alignment score increases and drift frequency declines.",
  },
  optimize: {
    id: "optimize",
    title: "Optimize",
    whyThisMatters: "Stable segments can create leverage when replicated into at-risk areas.",
    whatWillChange: "High-performing execution patterns are transferred as standard operating plays.",
    actions: [
      "Identify top two strong workspaces and extract repeatable plays.",
      "Apply one optimization play to each risk workspace.",
      "Track outcome delta over one weekly cycle.",
    ],
    expectedOutcome: "Portfolio average health and momentum improve without additional strategic drift.",
  },
  signal_strengthening: {
    id: "signal_strengthening",
    title: "Signal Strengthening",
    whyThisMatters: "Low signal quality reduces confidence in strategic diagnosis.",
    whatWillChange: "Artifact and outcome evidence increase, improving decision reliability.",
    actions: [
      "Require minimum artifact and outcome logging per workspace.",
      "Add weekly evidence check in portfolio review.",
      "Escalate low-signal workspaces until baseline sufficiency is met.",
    ],
    expectedOutcome: "Confidence distribution shifts from low to medium/high across portfolio diagnostics.",
  },
};

export function selectPriorityPlays(args: {
  phase: PortfolioPhase;
  hasLowSignalPattern: boolean;
}): ExecutivePriorityPlay[] {
  const orderByPhase: Record<PortfolioPhase, StrategicPlayId[]> = {
    "Stabilization Phase": ["stabilize", "realign", "optimize"],
    "Realignment Phase": ["realign", "stabilize", "optimize"],
    "Optimization Phase": ["optimize", "realign", "stabilize"],
    "Expansion Phase": ["optimize", "realign", "stabilize"],
  };

  const ordered = [...orderByPhase[args.phase]];
  if (args.hasLowSignalPattern) {
    ordered.push("signal_strengthening");
  }

  return ordered.slice(0, 3).map((playId, index) => ({
    ...PLAYBOOKS[playId],
    priority: index + 1,
  }));
}
