import type { RunCreateDTO, RunListItem, ScenarioCreateDTO, ScenarioListItem, ScenarioUpdateDTO } from "@/lib/decision-lab/types";

type ApiOk<T> = { ok: true; data: T };
type ApiFail = { ok: false; error: string; details?: string[] };

type ApiResponse<T> = ApiOk<T> | ApiFail;

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || !payload || !payload.ok) {
    const message = payload && !payload.ok ? payload.error : "Request failed";
    throw new Error(message);
  }

  return payload.data;
}

export async function fetchScenarios(workspaceSlug: string): Promise<ScenarioListItem[]> {
  return requestJson<ScenarioListItem[]>(`/api/w/${workspaceSlug}/decision-lab/scenarios`);
}

export async function createScenario(workspaceSlug: string, dto: ScenarioCreateDTO): Promise<ScenarioListItem> {
  return requestJson<ScenarioListItem>(`/api/w/${workspaceSlug}/decision-lab/scenarios`, {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

export async function updateScenario(workspaceSlug: string, scenarioId: string, dto: ScenarioUpdateDTO): Promise<ScenarioListItem> {
  return requestJson<ScenarioListItem>(`/api/w/${workspaceSlug}/decision-lab/scenarios/${scenarioId}`, {
    method: "PATCH",
    body: JSON.stringify(dto),
  });
}

export async function deleteScenario(workspaceSlug: string, scenarioId: string): Promise<{ ok: true }> {
  return requestJson<{ ok: true }>(`/api/w/${workspaceSlug}/decision-lab/scenarios/${scenarioId}`, {
    method: "DELETE",
  });
}

export async function fetchRuns(workspaceSlug: string, scenarioId?: string): Promise<RunListItem[]> {
  const url = new URL(`/api/w/${workspaceSlug}/decision-lab/runs`, window.location.origin);
  if (scenarioId) {
    url.searchParams.set("scenarioId", scenarioId);
  }

  return requestJson<RunListItem[]>(url.toString());
}

export async function createRun(workspaceSlug: string, dto: RunCreateDTO): Promise<RunListItem> {
  return requestJson<RunListItem>(`/api/w/${workspaceSlug}/decision-lab/runs`, {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

export async function fetchRun(workspaceSlug: string, runId: string): Promise<RunListItem> {
  return requestJson<RunListItem>(`/api/w/${workspaceSlug}/decision-lab/runs/${runId}`);
}

export async function deleteRun(workspaceSlug: string, runId: string): Promise<{ ok: true }> {
  return requestJson<{ ok: true }>(`/api/w/${workspaceSlug}/decision-lab/runs/${runId}`, {
    method: "DELETE",
  });
}
