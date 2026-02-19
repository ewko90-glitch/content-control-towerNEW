import { NextResponse } from "next/server";

import { getContentItemDetail, resolveContentContext, toErrorResponse, updateContentItem } from "@/lib/domain/content";

type RouteProps = {
  params: Promise<{ workspaceSlug: string; id: string }>;
};

export async function GET(request: Request, { params }: RouteProps) {
  const routeParams = await params;

  try {
    const context = await resolveContentContext(request, routeParams.workspaceSlug, "VIEWER");
    const item = await getContentItemDetail(context, routeParams.id);
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

export async function PATCH(request: Request, { params }: RouteProps) {
  const routeParams = await params;

  try {
    const context = await resolveContentContext(request, routeParams.workspaceSlug, "EDITOR");
    const body = (await request.json().catch(() => null)) as
      | {
          title?: string;
          channelId?: string | null;
          projectId?: string | null;
          dueAt?: string | null;
          assignedToUserId?: string | null;
          tags?: string | null;
          priority?: number;
        }
      | null;

    const item = await updateContentItem(context, routeParams.id, {
      title: body?.title,
      channelId: body?.channelId,
      projectId: body?.projectId,
      dueAt: body?.dueAt ? new Date(body.dueAt) : undefined,
      assignedToUserId: body?.assignedToUserId,
      tags: body?.tags,
      priority: body?.priority,
    });

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}