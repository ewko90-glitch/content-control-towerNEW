import { AIActionType, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { queueContentAiAction, resolveContentContext, toErrorResponse } from "@/lib/domain/content";

type RouteProps = {
  params: Promise<{ workspaceSlug: string }>;
};

export async function POST(request: Request, { params }: RouteProps) {
  const { workspaceSlug } = await params;

  try {
    const context = await resolveContentContext(request, workspaceSlug, "EDITOR");
    const body = (await request.json().catch(() => null)) as
      | {
          actionType?: AIActionType;
          contentItemId?: string;
          input?: Record<string, unknown>;
        }
      | null;

    if (!body?.actionType) {
      return NextResponse.json({ error: "Brakuje pola actionType." }, { status: 400 });
    }

    const job = await queueContentAiAction(
      context,
      body.actionType,
      body.contentItemId,
      body.input as Prisma.InputJsonValue | undefined,
    );
    return NextResponse.json({ ok: true, job }, { status: 202 });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}