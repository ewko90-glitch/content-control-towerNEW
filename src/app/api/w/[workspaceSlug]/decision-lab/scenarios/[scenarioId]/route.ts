import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth/session";
import { DecisionLabServiceError, deleteScenario, getScenario, updateScenario } from "@/lib/decision-lab/service";
import { validateScenarioUpdate } from "@/lib/decision-lab/validators";

type RouteProps = {
  params: Promise<{ workspaceSlug: string; scenarioId: string }>;
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

  const { workspaceSlug, scenarioId } = await params;

  try {
    const data = await getScenario(workspaceSlug, { userId: user.id }, scenarioId);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return mapError(error);
  }
}

export async function PATCH(request: Request, { params }: RouteProps) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = validateScenarioUpdate(body);

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

  const { workspaceSlug, scenarioId } = await params;

  try {
    const data = await updateScenario(workspaceSlug, { userId: user.id }, scenarioId, parsed.value);
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

  const { workspaceSlug, scenarioId } = await params;

  try {
    const data = await deleteScenario(workspaceSlug, { userId: user.id }, scenarioId);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return mapError(error);
  }
}
