import { NextResponse } from "next/server";

import { exportContentItem, resolveContentContext, toErrorResponse } from "@/lib/domain/content";

type RouteProps = {
  params: Promise<{ workspaceSlug: string; id: string }>;
};

export async function GET(request: Request, { params }: RouteProps) {
  const routeParams = await params;

  try {
    const context = await resolveContentContext(request, routeParams.workspaceSlug, "VIEWER");
    const url = new URL(request.url);
    const format = url.searchParams.get("format") === "md" ? "md" : "json";
    const exported = await exportContentItem(context, routeParams.id, format);

    return new NextResponse(exported.output, {
      status: 200,
      headers: {
        "content-type": exported.mimeType,
        "content-disposition": `attachment; filename="content-${routeParams.id}.${format}"`,
      },
    });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}