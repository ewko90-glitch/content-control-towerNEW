import { ContentType } from "@prisma/client";
import { NextResponse } from "next/server";

import { createContentItem, listContentBoard, resolveContentContext, toErrorResponse } from "@/lib/domain/content";

type RouteProps = {
  params: Promise<{ workspaceSlug: string }>;
};

export async function GET(request: Request, { params }: RouteProps) {
  const { workspaceSlug } = await params;

  try {
    const context = await resolveContentContext(request, workspaceSlug, "VIEWER");
    const items = await listContentBoard(context);
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

export async function POST(request: Request, { params }: RouteProps) {
  const { workspaceSlug } = await params;

  try {
    const context = await resolveContentContext(request, workspaceSlug, "EDITOR");
    const body = (await request.json().catch(() => null)) as
      | {
          title?: string;
          type?: ContentType;
          projectId?: string | null;
          channelId?: string | null;
          dueAt?: string | null;
          tags?: string | null;
          priority?: number;
        }
      | null;

    const item = await createContentItem(context, {
      title: String(body?.title ?? ""),
      type: body?.type,
      projectId: body?.projectId ?? null,
      channelId: body?.channelId ?? null,
      dueAt: body?.dueAt ? new Date(body.dueAt) : null,
      tags: body?.tags ?? null,
      priority: typeof body?.priority === "number" ? body.priority : 0,
    });

    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}