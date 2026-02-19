import { SPOTLIGHT_VERSION, type SpotlightStatus, type SpotlightStoredState } from "./spotlight-types";

function storageKey(workspaceSlug: string): string {
  return `cct:spotlight:${SPOTLIGHT_VERSION}:${workspaceSlug}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function fallbackState(): SpotlightStoredState {
  return {
    status: "active",
    stepIndex: 0,
    version: SPOTLIGHT_VERSION,
    updatedAt: nowIso(),
  };
}

export function readSpotlightState(workspaceSlug: string): SpotlightStoredState {
  try {
    const raw = window.localStorage.getItem(storageKey(workspaceSlug));
    if (!raw) {
      return fallbackState();
    }

    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return fallbackState();
    }

    const record = parsed as Record<string, unknown>;
    const status = record.status;
    const stepIndex = record.stepIndex;
    const version = record.version;
    const updatedAt = record.updatedAt;

    if (version !== SPOTLIGHT_VERSION) {
      return fallbackState();
    }

    if ((status !== "active" && status !== "completed" && status !== "dismissed") || typeof stepIndex !== "number") {
      return fallbackState();
    }

    return {
      status,
      stepIndex: Math.max(0, Math.floor(stepIndex)),
      version: SPOTLIGHT_VERSION,
      updatedAt: typeof updatedAt === "string" ? updatedAt : nowIso(),
    };
  } catch {
    return fallbackState();
  }
}

export function writeSpotlightState(workspaceSlug: string, partial: Pick<SpotlightStoredState, "status" | "stepIndex">): SpotlightStoredState {
  const next: SpotlightStoredState = {
    status: partial.status,
    stepIndex: Math.max(0, Math.floor(partial.stepIndex)),
    version: SPOTLIGHT_VERSION,
    updatedAt: nowIso(),
  };

  try {
    window.localStorage.setItem(storageKey(workspaceSlug), JSON.stringify(next));
  } catch {
    return next;
  }

  return next;
}

export function updateSpotlightStatus(workspaceSlug: string, status: SpotlightStatus): SpotlightStoredState {
  const current = readSpotlightState(workspaceSlug);
  return writeSpotlightState(workspaceSlug, { status, stepIndex: current.stepIndex });
}

export function restartSpotlight(workspaceSlug: string): SpotlightStoredState {
  return writeSpotlightState(workspaceSlug, { status: "active", stepIndex: 0 });
}
