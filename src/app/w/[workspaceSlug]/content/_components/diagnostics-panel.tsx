"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { clearTelemetry, getRecentTelemetry } from "@/lib/domain/controlTowerV3/telemetry";

type DiagnosticsPanelProps = {
  workspaceId: string;
};

export function DiagnosticsPanel({ workspaceId }: DiagnosticsPanelProps) {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const [refreshTick, setRefreshTick] = useState(0);
  const events = useMemo(() => {
    const list = getRecentTelemetry(workspaceId);
    return [...list]
      .sort((left, right) => new Date(right.timestampISO).getTime() - new Date(left.timestampISO).getTime())
      .slice(0, 20);
  }, [workspaceId, refreshTick]);

  return (
    <Card className="mb-6 rounded-2xl border border-border bg-surface2/60 shadow-soft">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Diagnostics (DEV)</CardTitle>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => setRefreshTick((value) => value + 1)}>
              Refresh
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                clearTelemetry(workspaceId);
                setRefreshTick((value) => value + 1);
              }}
            >
              Clear telemetry
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {events.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface p-3 text-xs text-muted">Brak eventów telemetry.</p>
        ) : (
          events.map((event) => (
            <div key={`${event.timestampISO}-${event.type}`} className="rounded-xl border border-border bg-surface p-3">
              <p className="text-xs text-muted">{event.timestampISO}</p>
              <p className="text-sm font-medium text-text">{event.type}</p>
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-xs text-muted">{JSON.stringify(event.metadata ?? {}, null, 2)}</pre>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
