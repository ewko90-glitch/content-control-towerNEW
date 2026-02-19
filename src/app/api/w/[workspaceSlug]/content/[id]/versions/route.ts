import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { createContentVersion, resolveContentContext, toErrorResponse } from "@/lib/domain/content";

type RouteProps = {
  params: Promise<{ workspaceSlug: string; id: string }>;
};

export async function POST(request: Request, { params }: RouteProps) {
  const routeParams = await params;

  try {
    const context = await resolveContentContext(request, routeParams.workspaceSlug, "EDITOR");
    const body = (await request.json().catch(() => null)) as
      | {
          body?: string;
          source?: string;
          promptSnapshot?: Record<string, unknown>;
        }
      | null;

    const version = await createContentVersion(
      context,
      routeParams.id,
      String(body?.body ?? ""),
      body?.source ?? "manual",
      body?.promptSnapshot as Prisma.InputJsonValue | undefined,
    );

    return NextResponse.json({ ok: true, version }, { status: 201 });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}