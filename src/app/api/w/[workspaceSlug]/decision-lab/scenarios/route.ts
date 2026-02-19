import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth/session";
import { DecisionLabServiceError, createScenario, listScenarios } from "@/lib/decision-lab/service";
import { validateScenarioCreate } from "@/lib/decision-lab/validators";

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

  try {
    const data = await listScenarios(workspaceSlug, { userId: user.id });
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
  const parsed = validateScenarioCreate(body);

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
    const data = await createScenario(workspaceSlug, { userId: user.id }, parsed.value);
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error) {
    return mapError(error);
  }
}
