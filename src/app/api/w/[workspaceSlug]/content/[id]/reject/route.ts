import { NextResponse } from "next/server";

import { rejectContentItem, resolveContentContext, toErrorResponse } from "@/lib/domain/content";

type RouteProps = {
  params: Promise<{ workspaceSlug: string; id: string }>;
};

export async function POST(request: Request, { params }: RouteProps) {
  const routeParams = await params;

  try {
    const context = await resolveContentContext(request, routeParams.workspaceSlug, "MANAGER");
    const body = (await request.json().catch(() => null)) as { note?: string } | null;
    const approval = await rejectContentItem(context, routeParams.id, String(body?.note ?? ""));
    return NextResponse.json({ ok: true, approval });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}