import type { ItemPrediction, RiskFactorCode } from "./types";

function phrase(code: RiskFactorCode): string {
  if (code === "STUCK") {
    return "stuck";
  }
  if (code === "SLA_PRESSURE") {
    return "sla pressure";
  }
  if (code === "WIP_OVERLOAD") {
    return "stage overload";
  }
  if (code === "BOTTLENECK") {
    return "bottleneck";
  }
  if (code === "AGE_OUTLIER") {
    return "age outlier";
  }
  if (code === "DUE_SOON") {
    return "due soon";
  }
  if (code === "FLOW_SLOWDOWN") {
    return "flow slowdown";
  }
  if (code === "VOLATILITY") {
    return "volatility";
  }
  if (code === "DATA_QUALITY") {
    return "low data quality";
  }
  return "no baseline";
}

export function buildRationale(pred: ItemPrediction): string {
  const top = pred.contributions.slice(0, 2).map((entry) => phrase(entry.code));
  const level = pred.riskLevel === "critical" ? "Critical" : pred.riskLevel === "high" ? "High" : pred.riskLevel === "medium" ? "Medium" : "Low";

  let text = `${level} risk`;
  if (top.length > 0) {
    text += `: ${top.join(" + ")}.`;
  } else {
    text += ".";
  }

  return text.replace(/[\r\n]+/g, " ").slice(0, 140);
}
