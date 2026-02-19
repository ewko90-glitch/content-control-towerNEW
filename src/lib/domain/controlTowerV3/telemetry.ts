export type TelemetryEvent = {
  workspaceId: string;
  type:
    | "daily_stack_built"
    | "focus_session_started"
    | "focus_session_completed"
    | "focus_session_abandoned"
    | "weekly_review_viewed"
    | "roi_viewed"
    | "pressure_computed"
    | "refresh_guidance_applied"
    | "executive_pack_opened"
    | "print_pack_clicked"
    | "digest_rendered"
    | "explain_opened";
  timestampISO: string;
  metadata?: Record<string, unknown>;
};

const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_EVENTS_PER_WORKSPACE = 300;

const telemetryStore = new Map<string, TelemetryEvent[]>();

function nowMs(): number {
  return Date.now();
}

function tsMs(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pruneWorkspace(workspaceId: string): TelemetryEvent[] {
  const events = telemetryStore.get(workspaceId) ?? [];
  const minTs = nowMs() - TTL_MS;

  const ttlFiltered = events.filter((event) => tsMs(event.timestampISO) >= minTs);
  const bounded = ttlFiltered.length > MAX_EVENTS_PER_WORKSPACE
    ? ttlFiltered.slice(ttlFiltered.length - MAX_EVENTS_PER_WORKSPACE)
    : ttlFiltered;

  telemetryStore.set(workspaceId, bounded);
  return bounded;
}

export function recordTelemetry(event: TelemetryEvent): void {
  const current = pruneWorkspace(event.workspaceId);
  const next = [...current, event];
  const bounded = next.length > MAX_EVENTS_PER_WORKSPACE
    ? next.slice(next.length - MAX_EVENTS_PER_WORKSPACE)
    : next;
  telemetryStore.set(event.workspaceId, bounded);
}

export function getRecentTelemetry(workspaceId: string): TelemetryEvent[] {
  return [...pruneWorkspace(workspaceId)];
}

export function clearTelemetry(workspaceId: string): void {
  telemetryStore.set(workspaceId, []);
}
