import type { WorkflowStageId } from "../types";

export type StageTone = "neutral" | "warning" | "success" | "info" | "accent";

export type StageColor = {
  tone: StageTone;
  bgClass: string;
  textClass: string;
  borderClass: string;
  dotClass?: string;
};

const STAGE_COLORS: Record<string, StageColor> = {
  draft: {
    tone: "neutral",
    bgClass: "bg-surface2",
    textClass: "text-muted",
    borderClass: "border-border",
    dotClass: "bg-muted",
  },
  review: {
    tone: "warning",
    bgClass: "bg-warning/20",
    textClass: "text-text",
    borderClass: "border-warning/40",
    dotClass: "bg-warning",
  },
  approved: {
    tone: "success",
    bgClass: "bg-success/20",
    textClass: "text-text",
    borderClass: "border-success/40",
    dotClass: "bg-success",
  },
  scheduled: {
    tone: "info",
    bgClass: "bg-primarySoft",
    textClass: "text-text",
    borderClass: "border-primary/30",
    dotClass: "bg-primary",
  },
  published: {
    tone: "accent",
    bgClass: "bg-primarySoft/80",
    textClass: "text-text",
    borderClass: "border-primary/40",
    dotClass: "bg-primary",
  },
};

const FALLBACK_COLOR: StageColor = {
  tone: "neutral",
  bgClass: "bg-surface2",
  textClass: "text-muted",
  borderClass: "border-border",
  dotClass: "bg-muted",
};

export function getStageColor(stageId: WorkflowStageId): StageColor {
  return STAGE_COLORS[stageId] ?? FALLBACK_COLOR;
}
