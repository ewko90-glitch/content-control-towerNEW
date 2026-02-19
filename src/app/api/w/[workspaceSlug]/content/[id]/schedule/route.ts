import { NextResponse } from "next/server";

import { resolveContentContext, schedulePublication, toErrorResponse } from "@/lib/domain/content";

type RouteProps = {
  params: Promise<{ workspaceSlug: string; id: string }>;
};

export async function POST(request: Request, { params }: RouteProps) {
  const routeParams = await params;

  try {
    const context = await resolveContentContext(request, routeParams.workspaceSlug, "MANAGER");
    const body = (await request.json().catch(() => null)) as { channelId?: string; scheduledAt?: string } | null;

    if (!body?.channelId || !body?.scheduledAt) {
      return NextResponse.json({ error: "Wymagane pola: channelId, scheduledAt." }, { status: 400 });
    }

    const publicationJob = await schedulePublication(context, routeParams.id, body.channelId, new Date(body.scheduledAt));
    return NextResponse.json({ ok: true, publicationJob });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}