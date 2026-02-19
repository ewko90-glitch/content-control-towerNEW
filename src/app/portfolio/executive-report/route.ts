import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { buildWorkspaceControlTowerSnapshot } from "@/modules/controlTowerV3";
import { buildExecutiveReport } from "@/modules/controlTowerV3/boardPackUltra/engine";
import { renderExecutiveReportPdf } from "@/modules/controlTowerV3/boardPackUltra/render";
import { buildPortfolioSnapshot } from "@/modules/controlTowerV3/portfolio/portfolio";

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nowIso = new Date().toISOString();
  const filter = request.nextUrl.searchParams.get("filter") ?? "all";

  const memberships = await prisma.workspaceMembership.findMany({
    where: {
      userId: user.id,
      workspace: {
        deletedAt: null,
      },
    },
    include: {
      workspace: {
        select: {
          id: true,
          slug: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const workspaces = memberships.map((membership) => ({
    id: membership.workspace.id,
    slug: membership.workspace.slug,
    name: membership.workspace.name,
  }));

  const model = await buildExecutiveReport({
    nowIso,
    filter,
    workspaces,
    loadPortfolioSnapshot: async ({ nowIso: effectiveNowIso, workspaces: effectiveWorkspaces }) =>
      buildPortfolioSnapshot({
        nowIso: effectiveNowIso,
        workspaces: effectiveWorkspaces,
        loadWorkspaceSnapshot: async (workspaceId) =>
          buildWorkspaceControlTowerSnapshot({
            workspaceId,
            nowIso: effectiveNowIso,
          }),
      }),
    loadWorkspaceSnapshot: async (workspaceId, effectiveNowIso) =>
      buildWorkspaceControlTowerSnapshot({
        workspaceId,
        nowIso: effectiveNowIso,
      }),
  });

  const pdfBytes = renderExecutiveReportPdf(model);
  const filename = `executive-report-${model.meta.scope}-${model.meta.generatedAtIso.slice(0, 10)}.pdf`;
  const pdfBuffer = new ArrayBuffer(pdfBytes.byteLength);
  new Uint8Array(pdfBuffer).set(pdfBytes);

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
