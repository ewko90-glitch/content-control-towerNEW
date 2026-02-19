import { WorkflowStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { moveContentItem, resolveContentContext, toErrorResponse } from "@/lib/domain/content";

type RouteProps = {
  params: Promise<{ workspaceSlug: string; id: string }>;
};

export async function POST(request: Request, { params }: RouteProps) {
  const routeParams = await params;

  try {
    const context = await resolveContentContext(request, routeParams.workspaceSlug, "EDITOR");
    const body = (await request.json().catch(() => null)) as { toStatus?: WorkflowStatus; note?: string } | null;
    const toStatus = body?.toStatus;

    if (!toStatus) {
      return NextResponse.json({ error: "Brakuje pola toStatus." }, { status: 400 });
    }

    const item = await moveContentItem(context, routeParams.id, toStatus, body?.note);
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}