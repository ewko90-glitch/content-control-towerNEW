import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth/session";
import { DecisionLabServiceError, createRun, listRuns } from "@/lib/decision-lab/service";
import { validateRunCreate } from "@/lib/decision-lab/validators";

type RouteProps = {
  params: Promise<{ workspaceSlug: string }>;
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

  const { workspaceSlug } = await params;
  const url = new URL(request.url);
  const scenarioId = url.searchParams.get("scenarioId") ?? undefined;

  try {
    const data = await listRuns(workspaceSlug, { userId: user.id }, { scenarioId });
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return mapError(error);
  }
}

export async function POST(request: Request, { params }: RouteProps) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = validateRunCreate(body);

  if (!parsed.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid input",
        details: parsed.errors,
      },
      { status: 400 },
    );
  }

  const { workspaceSlug } = await params;

  try {
    const data = await createRun(workspaceSlug, { userId: user.id }, parsed.value);
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error) {
    return mapError(error);
  }
}
