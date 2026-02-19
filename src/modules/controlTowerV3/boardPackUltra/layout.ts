import type { ExecutiveReportLayoutSection, ExecutiveReportModel } from "./types";

export function buildExecutiveReportLayout(model: ExecutiveReportModel): ExecutiveReportLayoutSection[] {
  const sections: ExecutiveReportLayoutSection[] = [
    {
      id: "executive-summary",
      title: "Executive Summary",
      pageBreakBefore: false,
      pageHint: 1,
    },
    {
      id: "portfolio-structural-analysis",
      title: "Portfolio Structural Analysis",
      pageBreakBefore: true,
      pageHint: 2,
    },
  ];

  for (let index = 0; index < model.workspaceBriefs.length; index += 1) {
    const brief = model.workspaceBriefs[index];
    sections.push({
      id: `workspace-${brief.workspaceSlug}`,
      title: `Workspace Strategic Brief — ${brief.workspaceName}`,
      pageBreakBefore: true,
      pageHint: 3 + index,
    });
  }

  return sections;
}
