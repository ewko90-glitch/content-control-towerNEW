import type { DecisionWarning, InputSummary } from "../types";

export function buildDecisionWarnings(params: {
  inputSummary: InputSummary;
  hasApprovalData: boolean;
  hasPublicationData: boolean;
  derivedMetricsReliable: boolean;
}): DecisionWarning[] {
  const warnings: DecisionWarning[] = [];

  if (params.inputSummary.contentCount === 0 && params.inputSummary.publicationJobsCount === 0) {
    warnings.push({
      code: "NO_CONTENT_YET",
      message: "Workspace has no content yet.",
      severity: "low",
    });
  }

  if (params.inputSummary.contentCount > 0 && params.inputSummary.publicationJobsCount === 0) {
    warnings.push({
      code: "NO_PUBLICATION_JOBS",
      message: "Content exists but no publication jobs are planned.",
      severity: "medium",
    });
  }

  if (!params.hasApprovalData) {
    warnings.push({
      code: "MISSING_APPROVAL_DATA",
      message: "Approval metrics are unavailable.",
      severity: "high",
    });
  }

  if (!params.derivedMetricsReliable || !params.hasPublicationData) {
    warnings.push({
      code: "DEGRADED_INPUT",
      message: "Input data reliability is degraded.",
      severity: "high",
    });
  }

  return warnings;
}
