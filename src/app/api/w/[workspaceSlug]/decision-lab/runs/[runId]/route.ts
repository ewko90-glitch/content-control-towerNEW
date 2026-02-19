import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth/session";
import { DecisionLabServiceError, deleteRun, getRun } from "@/lib/decision-lab/service";

type RouteProps = {
  params: Promise<{ workspaceSlug: string; runId: string }>;
};

function mapError(error: unknown) {
  if (error instanceof DecisionLabServiceError) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
        details: error.details,
      },
      { status: error.status },
    );
  }

  return NextResponse.json({ ok: false, error: "Request failed" }, { status: 400 });
}

export async function GET(request: Request, { params }: RouteProps) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceSlug, runId } = await params;

  try {
    const data = await getRun(workspaceSlug, { userId: user.id }, runId);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return mapError(error);
  }
}

export async function DELETE(request: Request, { params }: RouteProps) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceSlug, runId } = await params;

  try {
    const data = await deleteRun(workspaceSlug, { userId: user.id }, runId);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return mapError(error);
  }
}
