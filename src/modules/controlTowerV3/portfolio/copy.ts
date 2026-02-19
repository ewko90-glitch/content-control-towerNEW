import type { PortfolioRisk } from "./types";

export const portfolioCopy = {
  title: "Portfolio",
  subtitle: "Portfolio view for executive decision-making.",
  headline: {
    critical: (count: number) => `${count} workspaces are critical — stabilize execution before scaling output.`,
    drifting: (count: number) => `Strategic drift detected in ${count} workspaces — close loops and realign priorities.`,
    strong: (count: number) => `Portfolio is stable with ${count} strong workspaces — focus on optimization and leverage.`,
    stable: "Portfolio is stable — maintain cadence and monitor alignment.",
  },
  labels: {
    total: "Total",
    critical: "Critical",
    drifting: "Drifting",
    strong: "Strong",
    ranking: "Portfolio Ranking",
    insights: "Portfolio Insights",
    playbook: "Portfolio Playbook — What to do next",
    export: "Export board pack (PDF)",
    exportSoon: "Wkrótce",
  },
  empty: {
    rows: "No portfolio rows available.",
    insights: "No portfolio insights available.",
  },
  filters: {
    all: "All",
    critical: "Critical",
    drifting: "Drifting",
    strong: "Strong",
    misalignment: "Misalignment",
    noPlan: "No weekly plan",
  },
} as const;

export const portfolioRiskLabels: Record<PortfolioRisk["code"], string> = {
  strategic_drift: "Strategic drift",
  low_health: "Low health score",
  misalignment: "Strategic misalignment",
  no_weekly_plan: "No weekly plan",
  stalled_execution: "Stalled execution",
  low_signal: "Low signal confidence",
};

export const portfolioPlaybooks = {
  drift: {
    title: "Drift containment plan",
    steps: [
      "Select one strategic priority for each affected workspace.",
      "Close open approval loops within 24–48 hours.",
      "Cap non-priority WIP for the next 7 days.",
      "Review outcomes and re-score alignment at week end.",
    ],
  },
  critical: {
    title: "Critical health recovery",
    steps: [
      "Freeze optional work and focus on stability actions.",
      "Resolve blocked items and stale decisions first.",
      "Assign single-thread owner per critical workspace.",
      "Track daily progress against a visible metric.",
    ],
  },
  misalignment: {
    title: "Alignment reset",
    steps: [
      "Re-state strategic intent in one sentence.",
      "Map current actions to priorities and remove mismatches.",
      "Define one measurable weekly success metric.",
      "Run one controlled experiment and document outcome.",
    ],
  },
  noPlan: {
    title: "Weekly plan bootstrapping",
    steps: [
      "Generate 3 weekly moves: focus, stability, optimization.",
      "Assign owner and ETA to each move.",
      "Review progress mid-week and end-week.",
    ],
  },
  opportunity: {
    title: "Leverage strong performers",
    steps: [
      "Replicate top-performing workflow pattern to 1 at-risk workspace.",
      "Run one optimization experiment on high-traffic assets.",
      "Share winning playbook in weekly executive review.",
    ],
  },
} as const;
