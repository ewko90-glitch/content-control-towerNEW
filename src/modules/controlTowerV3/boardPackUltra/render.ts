import type { ExecutiveReportModel } from "./types";

type AttributionWindow = 7 | 14 | 30;

type DecisionAttributionView = {
  decisionId: string;
  adoptedAt: string;
  window: AttributionWindow;
  baselineScore: number;
  currentScore: number;
  deltaScore: number;
  estimatedROI: number;
  confidence: number;
  explanation: string;
};

type ReportWithAccountability = ExecutiveReportModel & {
  accountability?: {
    adoptedLast7Days: number;
    ignored: number;
    inProgress: number;
    totalMoves: number;
    avgImpactDelta7?: number;
    audit?: {
      lastAdoptionUpdateAtIso: string | null;
      signalsUsed: string[];
      confidenceNote: string;
      recentAdoptionEvents?: Array<{ moveTitle: string; status: string; atIso: string; source: string }>;
    };
  };
  decisionAttribution?: unknown;
  source?: {
    decisionAttribution?: unknown;
  };
};

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function confidenceChipClass(confidence: "low" | "medium" | "high"): string {
  if (confidence === "high") {
    return "chip chip--confidence-high";
  }
  if (confidence === "medium") {
    return "chip chip--confidence-medium";
  }
  return "chip chip--confidence-low";
}

function healthChipClass(score: number): string {
  if (score >= 80) {
    return "chip chip--health-strong";
  }
  if (score >= 60) {
    return "chip chip--health-ok";
  }
  if (score >= 40) {
    return "chip chip--health-risk";
  }
  return "chip chip--health-critical";
}

function formatAuditTimestamp(iso: string | null | undefined): { compact: string; rawIso: string } {
  if (!iso || !Number.isFinite(Date.parse(iso))) {
    return { compact: "n/a", rawIso: "n/a" };
  }
  const normalized = new Date(iso).toISOString();
  const compact = normalized.slice(0, 16).replace("T", " ");
  return { compact, rawIso: normalized };
}

function statusLabel(status: string): string {
  if (status === "in_progress") {
    return "In progress";
  }
  if (status === "not_started") {
    return "Not started";
  }
  if (status === "ignored") {
    return "Ignored";
  }
  return "Adopted";
}

function isValidWindow(value: unknown): value is AttributionWindow {
  return value === 7 || value === 14 || value === 30;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function truncateInsight(value: string, limit = 220): string {
  if (value.length <= limit) {
    return value;
  }
  const clipped = value.slice(0, Math.max(0, limit - 1));
  const safeCut = clipped.lastIndexOf(" ");
  const normalized = safeCut > 80 ? clipped.slice(0, safeCut) : clipped;
  return `${normalized}…`;
}

function formatInt(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(value));
}

function formatConfidencePercent(value: number): string {
  const bounded = Math.max(0, Math.min(1, value));
  return `${Math.round(bounded * 100)}%`;
}

function normalizeDecisionAttribution(model: ReportWithAccountability): DecisionAttributionView[] {
  const raw = Array.isArray(model.decisionAttribution)
    ? model.decisionAttribution
    : Array.isArray(model.source?.decisionAttribution)
      ? model.source?.decisionAttribution
      : [];

  const normalized = raw
    .map((entry): DecisionAttributionView | null => {
      if (typeof entry !== "object" || entry === null) {
        return null;
      }

      const decisionId = (entry as { decisionId?: unknown }).decisionId;
      const adoptedAt = (entry as { adoptedAt?: unknown }).adoptedAt;
      const window = (entry as { window?: unknown }).window;
      const baselineScore = asFiniteNumber((entry as { baselineScore?: unknown }).baselineScore);
      const currentScore = asFiniteNumber((entry as { currentScore?: unknown }).currentScore);
      const deltaScore = asFiniteNumber((entry as { deltaScore?: unknown }).deltaScore);
      const estimatedROI = asFiniteNumber((entry as { estimatedROI?: unknown }).estimatedROI);
      const confidence = asFiniteNumber((entry as { confidence?: unknown }).confidence);
      const explanation = (entry as { explanation?: unknown }).explanation;

      if (typeof decisionId !== "string" || decisionId.trim().length === 0) {
        return null;
      }
      if (typeof adoptedAt !== "string" || adoptedAt.trim().length === 0) {
        return null;
      }
      if (!isValidWindow(window)) {
        return null;
      }
      if (baselineScore === null || currentScore === null || deltaScore === null || estimatedROI === null || confidence === null) {
        return null;
      }
      if (typeof explanation !== "string" || explanation.trim().length === 0) {
        return null;
      }

      return {
        decisionId: decisionId.trim(),
        adoptedAt: adoptedAt.trim(),
        window,
        baselineScore,
        currentScore,
        deltaScore,
        estimatedROI,
        confidence,
        explanation: truncateInsight(explanation.trim()),
      };
    })
    .filter((entry): entry is DecisionAttributionView => entry !== null)
    .sort((left, right) => {
      const byAbsDelta = Math.abs(right.deltaScore) - Math.abs(left.deltaScore);
      if (byAbsDelta !== 0) {
        return byAbsDelta;
      }
      const byId = left.decisionId.localeCompare(right.decisionId);
      if (byId !== 0) {
        return byId;
      }
      const byWindow = left.window - right.window;
      if (byWindow !== 0) {
        return byWindow;
      }
      return left.adoptedAt.localeCompare(right.adoptedAt);
    })
    .slice(0, 5);

  return normalized;
}

function toPdfTextLines(model: ReportWithAccountability): string[] {
  const lines: string[] = [];
  const attribution = normalizeDecisionAttribution(model);

  lines.push(model.meta.title);
  lines.push(model.meta.subtitle);
  lines.push(`Generated: ${model.meta.generatedAtIso}`);
  lines.push(`Scope: ${model.meta.scope}`);
  lines.push(`Phase: ${model.meta.phase}`);
  lines.push("");

  lines.push("Executive Headline");
  lines.push(model.executiveSummary.strategicHeadline);
  lines.push(model.executiveSummary.portfolioNarrative);
  lines.push("");

  lines.push("Executive Snapshot");
  lines.push(`Total Workspaces: ${model.executiveSummary.kpis.totalWorkspaces}`);
  lines.push(`Critical: ${model.executiveSummary.kpis.critical}`);
  lines.push(`Drifting: ${model.executiveSummary.kpis.drifting}`);
  lines.push(`Strong: ${model.executiveSummary.kpis.strong}`);
  lines.push(`Average Alignment: ${model.executiveSummary.kpis.averageAlignment}`);
  lines.push(`Average Health: ${model.executiveSummary.kpis.averageHealth}`);
  if (model.accountability) {
    lines.push(`Moves adopted (7d): ${model.accountability.adoptedLast7Days}`);
    lines.push(`Moves in progress: ${model.accountability.inProgress}`);
    lines.push(`Moves ignored: ${model.accountability.ignored}`);
    lines.push(`Avg impact delta (7d): ${model.accountability.avgImpactDelta7 ?? 0}`);
    if (model.accountability.audit) {
      const auditDate = formatAuditTimestamp(model.accountability.audit.lastAdoptionUpdateAtIso);
      lines.push(`Last adoption update: ${auditDate.compact} (${auditDate.rawIso})`);
      lines.push("Signals used:");
      for (const signal of model.accountability.audit.signalsUsed) {
        lines.push(`- ${signal}`);
      }
      lines.push(`Confidence note: ${model.accountability.audit.confidenceNote}`);
      for (const event of model.accountability.audit.recentAdoptionEvents ?? []) {
        const eventDate = formatAuditTimestamp(event.atIso);
        lines.push(`${statusLabel(event.status)}: ${event.moveTitle} — ${eventDate.compact} — source: ${event.source}`);
      }
    }
  }
  lines.push("");

  if (attribution.length > 0) {
    const totalDelta = attribution.reduce((sum, item) => sum + item.deltaScore, 0);
    const totalRoi = attribution.reduce((sum, item) => sum + item.estimatedROI, 0);
    const avgConfidence = attribution.reduce((sum, item) => sum + item.confidence, 0) / attribution.length;

    lines.push("Decision Attribution & ROI Impact");
    lines.push("Measured impact of adopted strategic decisions");
    if (attribution.length > 1) {
      lines.push(
        `Across ${attribution.length} strategic decisions, the Control Score improved by ${formatInt(totalDelta)} points, corresponding to an estimated combined ROI of ${formatInt(totalRoi)}. Average confidence level: ${formatConfidencePercent(avgConfidence)}.`,
      );
    }
    for (const item of attribution) {
      lines.push(`Decision Reference: ${item.decisionId}`);
      lines.push(`Impact Window: ${item.window} days`);
      lines.push(`Control Score Improvement: ${formatInt(item.deltaScore)} pts`);
      lines.push(`Estimated ROI: ${formatInt(item.estimatedROI)}`);
      lines.push(`Confidence Level: ${formatConfidencePercent(item.confidence)}`);
      lines.push(`Executive Insight: ${item.explanation}`);
    }
    lines.push("");
  }

  lines.push("Priority Plays");
  for (const play of model.executiveSummary.priorityPlays) {
    lines.push(`${play.priority}. ${play.title}`);
    lines.push(`Why: ${play.whyThisMatters}`);
    lines.push(`Change: ${play.whatWillChange}`);
    lines.push(`Outcome: ${play.expectedOutcome}`);
    for (const action of play.actions) {
      lines.push(`- ${action}`);
    }
  }

  lines.push("");
  lines.push("Structural Analysis");
  for (const pattern of model.structuralAnalysis.systemicPatterns) {
    lines.push(`${pattern.title} [${pattern.severity}]`);
    lines.push(pattern.narrative);
  }

  lines.push("");
  lines.push("Workspace Briefs");
  for (const brief of model.workspaceBriefs) {
    lines.push(`${brief.workspaceName} (${brief.workspaceSlug})`);
    lines.push(`Health ${brief.strategicStatus.health}, Alignment ${brief.strategicStatus.alignment}, Drift ${brief.strategicStatus.drift ? "Yes" : "No"}, Confidence ${brief.strategicStatus.confidence}`);
    lines.push(brief.executiveDiagnosis);
    for (const action of brief.operationalPrescription) {
      lines.push(`Action: ${action.title} [${action.effort}]`);
    }
    lines.push(brief.signal.note);
    lines.push("");
  }

  return lines;
}

export function renderExecutiveReportHtml(model: ReportWithAccountability): string {
  const attribution = normalizeDecisionAttribution(model);
  const rows = model.structuralAnalysis.rankingMatrix
    .map(
      (row) =>
        `<tr><td><span class="workspace-name">${escapeHtml(row.workspaceName)}</span><div class="slug">/${escapeHtml(
          row.workspaceSlug,
        )}</div></td><td>${row.healthScore}</td><td>${row.strategicAlignmentScore}</td><td>${
          row.driftDetected ? '<span class="chip chip--drift">Drift</span>' : '<span class="muted">No</span>'
        }</td><td>${row.momentum7d}</td><td><span class="chip chip--risk">${escapeHtml(row.risks[0]?.severity ?? "low")}</span></td></tr>`,
    )
    .join("");

  const patterns = model.structuralAnalysis.systemicPatterns
    .map(
      (pattern) =>
        `<article class="block pattern"><h4>${escapeHtml(pattern.title)} <span class="chip">${escapeHtml(pattern.severity)}</span></h4><p>${escapeHtml(
          pattern.narrative,
        )}</p><p class="meta">Affected: ${escapeHtml(pattern.affected.map((item) => item.name).join(", "))}</p></article>`,
    )
    .join("");

  const plays = model.executiveSummary.priorityPlays
    .map(
      (play) =>
        `<article class="block play"><h4>${play.priority}. ${escapeHtml(play.title)}</h4><p><strong>Why this matters:</strong> ${escapeHtml(
          play.whyThisMatters,
        )}</p><p><strong>What will change:</strong> ${escapeHtml(play.whatWillChange)}</p><ul>${play.actions
          .map((action) => `<li>${escapeHtml(action)}</li>`)
          .join("")}</ul><p><strong>Expected outcome:</strong> ${escapeHtml(play.expectedOutcome)}</p></article>`,
    )
    .join("");

  const workspaces = model.workspaceBriefs
    .map(
      (brief) =>
        `<article class="workspace-panel ctv3-workspace-panel ctv3-avoid-break page-break-hint"><h4>${escapeHtml(brief.workspaceName)} <span class="slug">/${escapeHtml(
          brief.workspaceSlug,
        )}</span></h4><div class="chip-row ctv3-metrics-strip"><span class="${healthChipClass(brief.strategicStatus.health)}">Health <span class="ctv3-metric-value">${
          brief.strategicStatus.health
        }</span></span><span class="chip chip--alignment">Alignment <span class="ctv3-metric-value">${
          brief.strategicStatus.alignment
        }</span></span>${
          brief.strategicStatus.drift ? '<span class="chip chip--drift">Drift</span>' : ""
        }<span class="${confidenceChipClass(brief.strategicStatus.confidence)}">Confidence <span class="ctv3-metric-value">${escapeHtml(
          brief.strategicStatus.confidence,
        )}</span></span></div><div class="ctv3-prose"><p>${escapeHtml(brief.executiveDiagnosis)}</p></div><div class="ctv3-section-block"><h5 class="ctv3-section-label">Weekly Strategic Moves</h5><ul class="ctv3-moves-list">${brief.weeklyMoves
          .map(
            (move) =>
              `<li><span class="ctv3-item-title">${escapeHtml(move.kind)}: ${escapeHtml(move.title)}</span><span class="chip chip--risk">${escapeHtml(
                String((move as any).adoptionStatus ?? "not_started").replace("_", " "),
              )}</span>${
                typeof (move as any).impact7dText === "string"
                  ? `<div class=\"ctv3-prose\"><p class=\"ctv3-muted\">${escapeHtml(String((move as any).impact7dText))}</p></div>`
                  : ""
              }<div class="ctv3-prose"><p class="ctv3-muted">metric: ${escapeHtml(
                move.metric,
              )} • effort: <span class="chip chip--effort">${move.effort}</span> • risk: <span class="chip chip--risk">${escapeHtml(
                move.risk,
              )}</span> • impact: ${escapeHtml(move.expectedImpact)}</p></div></li>`,
          )
          .join("")}</ul></div><div class="ctv3-section-block"><h5 class="ctv3-section-label">Top Risks</h5><ul class="ctv3-risks-list">${brief.riskRegister
          .map(
            (risk) =>
              `<li><span class="ctv3-item-title">${escapeHtml(risk.label)}</span> <span class="chip chip--risk">${escapeHtml(risk.severity)}</span>${
                risk.evidence ? `<div class=\"ctv3-prose\"><p class=\"ctv3-muted\">${escapeHtml(risk.evidence)}</p></div>` : ""
              }</li>`,
          )
          .join("")}</ul></div><div class="ctv3-section-block"><h5 class="ctv3-section-label">Next 5 Actions</h5><ol class="ctv3-actions-list">${brief.operationalPrescription
          .map(
            (item) =>
              `<li><span class="ctv3-item-title">${escapeHtml(item.title)}</span> <span class="chip chip--effort">${item.effort}</span><div class="ctv3-prose"><p class="ctv3-muted">${escapeHtml(
                item.why,
              )}</p><p>Expected: ${escapeHtml(item.expectedOutcome)}</p></div></li>`,
          )
          .join("")}</ol></div><div class="ctv3-section-block"><h5 class="ctv3-section-label">Signals & Confidence</h5><div class="ctv3-prose"><p class="meta ctv3-muted">${escapeHtml(
          brief.signal.note,
        )}</p></div></div></article>`,
    )
    .join("");

  const auditDate = formatAuditTimestamp(model.accountability?.audit?.lastAdoptionUpdateAtIso ?? null);
  const auditSignals = (model.accountability?.audit?.signalsUsed ?? [])
    .map((signal) => `<li>${escapeHtml(signal)}</li>`)
    .join("");
  const auditEvents = (model.accountability?.audit?.recentAdoptionEvents ?? [])
    .map((event) => {
      const eventDate = formatAuditTimestamp(event.atIso);
      return `<li><span class="ctv3-item-title">${escapeHtml(statusLabel(event.status))}:</span> ${escapeHtml(event.moveTitle)} — ${escapeHtml(
        eventDate.compact,
      )} — <span class="ctv3-muted">source: ${escapeHtml(event.source)}</span></li>`;
    })
    .join("");

  const attributionSummary =
    attribution.length > 1
      ? (() => {
          const totalDelta = attribution.reduce((sum, item) => sum + item.deltaScore, 0);
          const totalRoi = attribution.reduce((sum, item) => sum + item.estimatedROI, 0);
          const avgConfidence = attribution.reduce((sum, item) => sum + item.confidence, 0) / attribution.length;
          return `Across ${attribution.length} strategic decisions, the Control Score improved by ${formatInt(
            totalDelta,
          )} points, corresponding to an estimated combined ROI of ${formatInt(totalRoi)}. Average confidence level: ${formatConfidencePercent(
            avgConfidence,
          )}.`;
        })()
      : "";

  const attributionBlocks = attribution
    .map(
      (item) =>
        `<article class="block ctv3-attr-block ctv3-avoid-break"><h4><span class="ctv3-attr-ref">Decision Reference:</span> ${escapeHtml(
          item.decisionId,
        )}</h4><div class="kpi-grid ctv3-attr-grid"><div class="kpi">Impact Window: ${item.window} days</div><div class="kpi">Control Score Improvement: ${escapeHtml(
          formatInt(item.deltaScore),
        )} pts</div><div class="kpi">Estimated ROI: ${escapeHtml(formatInt(item.estimatedROI))}</div><div class="kpi">Confidence Level: ${escapeHtml(
          formatConfidencePercent(item.confidence),
        )}</div></div><div class="ctv3-prose"><p><strong>Executive Insight:</strong> ${escapeHtml(item.explanation)}</p></div></article>`,
    )
    .join("");

  return `<style>
.ctv3-report{font-family:Arial,system-ui,-apple-system,sans-serif;color:#1d2430;line-height:1.58;font-size:14px}
.ctv3-report *{box-sizing:border-box}
.ctv3-report__paper{max-width:1040px;margin:0 auto;padding:24px 22px;background:#fbfaf7;border:1px solid #ece8df;border-radius:18px;box-shadow:0 8px 28px rgba(16,24,40,.06)}
.ctv3-report h1{font-size:30px;line-height:1.2;letter-spacing:-.015em;margin:0 0 6px;font-weight:650;color:#111827}
.ctv3-report h2{font-size:18px;line-height:1.35;margin:0 0 10px;font-weight:580;color:#344054}
.ctv3-report h3{font-size:17px;line-height:1.35;margin:15px 0 8px;font-weight:640;color:#101828}
.ctv3-report h4{font-size:15px;line-height:1.4;margin:11px 0 6px;font-weight:600;color:#111827}
.ctv3-report h5{font-size:13px;line-height:1.45;margin:12px 0 6px;font-weight:600;color:#344054}
.ctv3-report section{margin:0 0 20px;padding:0 0 2px}
.ctv3-report section+section{padding-top:18px;border-top:1px solid #ece8df}
.ctv3-report section[id]{scroll-margin-top:72px}
.ctv3-report .meta{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;margin-bottom:8px}
.ctv3-report .summary-note{font-size:15px;color:#344054;margin:10px 0 14px}
.ctv3-report .kpi-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.ctv3-report .kpi{border:1px solid #e6e2d8;background:#f6f4ef;padding:10px 12px;border-radius:12px;color:#273244}
.ctv3-report .table-wrap{overflow-x:auto;border:1px solid #e8e3da;border-radius:12px;background:#fff}
.ctv3-report table{width:100%;border-collapse:collapse;min-width:760px}
.ctv3-report thead th{background:#f0efe9;color:#2f3a4c;font-size:12px;font-weight:620;padding:8px;text-align:left;border-bottom:1px solid #ddd8cf}
.ctv3-report tbody td{padding:8px;color:#1f2937;font-size:12px;border-bottom:1px solid #ece7df;vertical-align:top;line-height:1.5}
.ctv3-report tbody tr:nth-child(even){background:rgba(148,163,184,.08)}
.ctv3-report tbody tr:last-child td{border-bottom:0}
.ctv3-report .workspace-name{display:block;max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600}
.ctv3-report .slug{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;color:#667085}
.ctv3-report .chip-row{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 10px}
.ctv3-report .chip{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:999px;border:1px solid #d9dce2;font-size:11px;line-height:1.2;color:#344054;background:#f7f8fa}
.ctv3-report .ctv3-metrics-strip .chip{font-weight:600}
.ctv3-report .ctv3-metrics-strip .chip+.chip{position:relative;margin-left:8px}
.ctv3-report .ctv3-metrics-strip .chip+.chip::before{content:"";position:absolute;left:-8px;top:3px;bottom:3px;width:1px;background:rgba(71,85,105,.18)}
.ctv3-report .ctv3-metric-value{font-weight:700;color:#101828}
.ctv3-report .chip--health-strong{background:#edf8f1;border-color:#ccead7;color:#165a35}
.ctv3-report .chip--health-ok{background:#eef5ff;border-color:#d5e4fb;color:#1f4b86}
.ctv3-report .chip--health-risk{background:#fff6ea;border-color:#f5e0bc;color:#7a4f1b}
.ctv3-report .chip--health-critical{background:#fff0f1;border-color:#f5d2d6;color:#8c2f3c}
.ctv3-report .chip--alignment{background:#f2f4f7;border-color:#e1e5ea;color:#3f4754}
.ctv3-report .chip--drift{background:#fff1f0;border-color:#f0d2cf;color:#8d3b35}
.ctv3-report .chip--risk{background:#f5f6fa;border-color:#e2e5ee;color:#465063;text-transform:capitalize}
.ctv3-report .chip--effort{background:#f7f6ee;border-color:#e7e2ca;color:#5b5f33}
.ctv3-report .chip--confidence-high{background:#edf8f1;border-color:#ccead7;color:#1f6b45}
.ctv3-report .chip--confidence-medium{background:#fff7eb;border-color:#f2dfc0;color:#835727}
.ctv3-report .chip--confidence-low{background:#fff0f1;border-color:#f1d0d4;color:#8c2f3c}
.ctv3-report .block{border:1px solid #e8e3da;background:#fcfbf8;padding:12px;border-radius:12px;margin-bottom:10px}
.ctv3-report .workspace-panel{border:1px solid #e8e3da;background:#fffdf9;padding:14px;border-radius:14px;margin-bottom:12px}
.ctv3-report .ctv3-workspace-panel .ctv3-section-label{text-transform:uppercase;letter-spacing:.04em;font-size:11px;font-weight:620;color:#475467;margin:2px 0 6px}
.ctv3-report .ctv3-workspace-panel .ctv3-section-block+.ctv3-section-block{margin-top:10px;padding-top:10px;border-top:1px solid rgba(71,85,105,.12)}
.ctv3-report .ctv3-workspace-panel .ctv3-item-title{font-weight:620;color:#111827}
.ctv3-report .ctv3-moves-list li,.ctv3-report .ctv3-risks-list li,.ctv3-report .ctv3-actions-list li{margin:6px 0}
.ctv3-report .ctv3-prose{max-width:72ch}
.ctv3-report .ctv3-prose p{line-height:1.65;margin:0 0 6px}
.ctv3-report ul,.ctv3-report ol{margin:5px 0 0;padding-left:18px}
.ctv3-report li{margin:4px 0}
.ctv3-report .muted{color:#667085;font-size:12px}
.ctv3-report .ctv3-muted{color:#4b5565;font-size:12px;line-height:1.5}
.ctv3-report .ctv3-attr-ref{font-weight:650;color:#101828}
.ctv3-report .ctv3-attr-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
.ctv3-report .ctv3-attr-block .kpi{min-height:44px}
.ctv3-report .page-break-hint{break-inside:avoid}
.ctv3-report .ctv3-break-before{break-before:page;page-break-before:always}
.ctv3-report .ctv3-avoid-break{break-inside:avoid;page-break-inside:avoid}
@media print{
  .ctv3-report{color:#111}
  .ctv3-report__paper{background:#fff;border-color:#cfcfcf;box-shadow:none;padding:16px}
  .ctv3-report section+section{border-top-color:#d8d8d8}
  .ctv3-report .table-wrap{border-color:#d8d8d8}
  .ctv3-report thead th{font-size:12px;line-height:1.45;background:#f4f4f4;color:#1f2937}
  .ctv3-report tbody td{font-size:12px;line-height:1.55;color:#111827}
  .ctv3-report .block,.ctv3-report .workspace-panel{border-color:#d8d8d8;box-shadow:none}
  .ctv3-report .workspace-panel,.ctv3-report .ctv3-avoid-break{break-inside:avoid;page-break-inside:avoid}
  .ctv3-report #patterns,.ctv3-report #plays{break-inside:avoid;page-break-inside:avoid}
}
@media (max-width: 768px){
  .ctv3-report__paper{padding:16px 14px;border-radius:14px}
  .ctv3-report h1{font-size:24px}
  .ctv3-report h2{font-size:16px}
  .ctv3-report .kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media (max-width: 900px){
  .ctv3-report .ctv3-prose{max-width:100%}
}
</style>
<div class="ctv3-report">
<div class="ctv3-report__paper">
<section id="summary" class="page-break-hint ctv3-avoid-break">
<p class="meta">Generated: ${escapeHtml(model.meta.generatedAtIso)} • Scope: ${escapeHtml(model.meta.scope)} • Phase: ${escapeHtml(model.meta.phase)}</p>
<h1>${escapeHtml(model.meta.title)}</h1>
<h2>${escapeHtml(model.meta.subtitle)}</h2>
<p class="summary-note"><strong>${escapeHtml(model.executiveSummary.strategicHeadline)}</strong></p>
<p>${escapeHtml(model.executiveSummary.portfolioNarrative)}</p>
<div class="kpi-grid">
  <div class="kpi">Total Workspaces: ${model.executiveSummary.kpis.totalWorkspaces}</div>
  <div class="kpi">Critical: ${model.executiveSummary.kpis.critical}</div>
  <div class="kpi">Drifting: ${model.executiveSummary.kpis.drifting}</div>
  <div class="kpi">Strong: ${model.executiveSummary.kpis.strong}</div>
  <div class="kpi">Average Alignment: ${model.executiveSummary.kpis.averageAlignment}</div>
  <div class="kpi">Average Health: ${model.executiveSummary.kpis.averageHealth}</div>
</div>
<div class="ctv3-section-block">
  <h5 class="ctv3-section-label">Accountability Overview</h5>
  <div class="kpi-grid">
    <div class="kpi">Moves adopted (7d): ${model.accountability?.adoptedLast7Days ?? 0}</div>
    <div class="kpi">Moves in progress: ${model.accountability?.inProgress ?? 0}</div>
    <div class="kpi">Moves ignored: ${model.accountability?.ignored ?? 0}</div>
    <div class="kpi">Total moves: ${model.accountability?.totalMoves ?? 0}</div>
    <div class="kpi">Avg impact delta (7d): ${model.accountability?.avgImpactDelta7 ?? 0}</div>
  </div>
  <div class="ctv3-section-block">
    <h5 class="ctv3-section-label">Audit Trail</h5>
    <div class="ctv3-prose"><p class="ctv3-muted">Last adoption update: ${escapeHtml(auditDate.compact)} <span class="chip">${escapeHtml(
      auditDate.rawIso,
    )}</span></p></div>
    <div class="ctv3-prose"><p class="ctv3-muted">Signals used:</p><ul>${auditSignals || "<li>Baseline snapshot (at adoption)</li>"}</ul></div>
    <div class="ctv3-prose"><p class="ctv3-muted">Confidence note: ${escapeHtml(
      model.accountability?.audit?.confidenceNote ?? "Impact is early and may be noisy; confidence is low due to sparse signals.",
    )}</p></div>
    ${auditEvents ? `<div class="ctv3-prose"><p class="ctv3-muted">Recent adoption events:</p><ul>${auditEvents}</ul></div>` : ""}
  </div>
</div>
</section>
${
  attributionBlocks
    ? `<section id="decision-attribution" class="page-break-hint ctv3-avoid-break"><h3>Decision Attribution & ROI Impact</h3><p class="meta">Measured impact of adopted strategic decisions</p>${
        attributionSummary ? `<p class="summary-note">${escapeHtml(attributionSummary)}</p>` : ""
      }${attributionBlocks}</section>`
    : ""
}
<section id="portfolio" class="page-break-hint">
<h3>Ranking Matrix</h3>
<div class="table-wrap">
<table>
<thead><tr><th>Workspace</th><th>Health</th><th>Alignment</th><th>Drift</th><th>Momentum</th><th>Risk Level</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</div>
</section>
<section id="patterns" class="page-break-hint ctv3-avoid-break">
<h3>Systemic Patterns</h3>
${patterns || "<p class=\"meta\">No systemic patterns detected.</p>"}
</section>
<section id="plays" class="page-break-hint ctv3-avoid-break">
<h3>Priority Plays</h3>
${plays}
</section>
<section id="workspaces" class="page-break-hint ctv3-break-before">
<h3>Workspace Strategic Briefs</h3>
${workspaces || "<p class=\"meta\">No workspace briefs available.</p>"}
</section>
</div>
</div>`;
}

export function renderExecutiveReportPdf(model: ReportWithAccountability): Uint8Array {
  const lines = toPdfTextLines(model).slice(0, 180);

  let y = 790;
  const contentChunks: string[] = ["BT\n/F1 10 Tf\n40 790 Td\n"];
  for (const rawLine of lines) {
    if (y < 60) {
      break;
    }
    const line = escapePdfText(rawLine);
    contentChunks.push(`(${line}) Tj\n`);
    y -= 12;
    if (y >= 60) {
      contentChunks.push(`0 -12 Td\n`);
    }
  }
  contentChunks.push("ET\n");

  const contentStream = contentChunks.join("");

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream\nendobj\n`,
  ];

  const header = "%PDF-1.4\n";
  let offset = header.length;
  const xrefOffsets: number[] = [0];
  const body = objects
    .map((obj) => {
      xrefOffsets.push(offset);
      offset += obj.length;
      return obj;
    })
    .join("");

  const xrefStart = offset;
  const xref =
    `xref\n0 ${objects.length + 1}\n` +
    xrefOffsets.map((item, index) => (index === 0 ? "0000000000 65535 f " : `${String(item).padStart(10, "0")} 00000 n `)).join("\n") +
    "\n";

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  const fullPdf = header + body + xref + trailer;

  return new TextEncoder().encode(fullPdf);
}
