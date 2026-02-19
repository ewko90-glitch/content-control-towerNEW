import { NextResponse } from "next/server";

import { listCalendarItems, resolveContentContext, toErrorResponse } from "@/lib/domain/content";

type RouteProps = {
  params: Promise<{ workspaceSlug: string }>;
};

export async function GET(request: Request, { params }: RouteProps) {
  const { workspaceSlug } = await params;

  try {
    const context = await resolveContentContext(request, workspaceSlug, "VIEWER");
    const url = new URL(request.url);
    const from = url.searchParams.get("from");

    const weekStart = from ? new Date(from) : new Date();
    weekStart.setHours(0, 0, 0, 0);

    const day = weekStart.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    weekStart.setDate(weekStart.getDate() + diffToMonday);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const jobs = await listCalendarItems(context, weekStart, weekEnd);
    return NextResponse.json({ ok: true, weekStart, weekEnd, jobs });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}