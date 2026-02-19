"use client";

import { useEffect, useMemo, useState } from "react";
import type { MetricSnapshot } from "@/components/decision-impact/impact-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { DecisionCard } from "./decision-card";
import { decisionCopy } from "./decision-copy";
import { loadDecisionStore } from "./decision-storage";
import type { DecisionEntry } from "./decision-types";

type DecisionTimelineProps = {
  workspaceSlug: string;
  currentSnapshot?: MetricSnapshot;
};

function readTimeline(workspaceSlug: string): { entries: DecisionEntry[]; currentId?: string } {
  try {
    const store = loadDecisionStore(workspaceSlug);
    return {
      entries: store.entries.slice(0, 5),
      currentId: store.currentStrategyId,
    };
  } catch {
    return { entries: [], currentId: undefined };
  }
}

export function DecisionTimeline(props: DecisionTimelineProps) {
  const [entries, setEntries] = useState<DecisionEntry[]>([]);
  const [currentId, setCurrentId] = useState<string | undefined>(undefined);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    try {
      const next = readTimeline(props.workspaceSlug);
      setEntries(next.entries);
      setCurrentId(next.currentId);
      setVisible(true);
    } catch {
      setVisible(false);
    }
  }, [props.workspaceSlug]);

  useEffect(() => {
    const onRefresh = () => {
      try {
        const next = readTimeline(props.workspaceSlug);
        setEntries(next.entries);
        setCurrentId(next.currentId);
      } catch {
        setVisible(false);
      }
    };

    window.addEventListener("cct:decision:updated", onRefresh as EventListener);
    return () => {
      window.removeEventListener("cct:decision:updated", onRefresh as EventListener);
    };
  }, [props.workspaceSlug]);

  const hasData = useMemo(() => entries.length > 0, [entries]);

  if (!visible) {
    return null;
  }

  return (
    <Card id="decision-timeline" className="rounded-2xl border border-border bg-card shadow-soft">
      <CardHeader className="space-y-1">
        <CardTitle>{decisionCopy.timelineTitle}</CardTitle>
        <p className="text-sm text-textMuted">{decisionCopy.timelineSubtitle}</p>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {entries.map((entry) => (
              <DecisionCard
                key={entry.id}
                entry={entry}
                isCurrentStrategy={entry.id === currentId}
                currentSnapshot={props.currentSnapshot}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-textMuted">{decisionCopy.empty}</p>
        )}
      </CardContent>
    </Card>
  );
}
