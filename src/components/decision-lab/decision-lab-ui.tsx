"use client";

import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import type { StageProjection } from "@/lib/workflow";
import { cn } from "@/styles/cn";

function formatMetric(value?: number, digits = 1): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }
  return value.toFixed(digits);
}

export function DeltaChip({
  delta,
  goodWhenPositive,
  suffix,
}: {
  delta?: number;
  goodWhenPositive: boolean;
  suffix?: string;
}) {
  if (typeof delta !== "number" || Number.isNaN(delta)) {
    return <Badge variant="credits">—</Badge>;
  }

  const isPositive = delta > 0;
  const isNeutral = delta === 0;
  const good = isNeutral ? false : goodWhenPositive ? isPositive : !isPositive;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        isNeutral && "border-border bg-surface2 text-textMuted",
        !isNeutral && good && "border-primary/40 bg-primarySoft text-text",
        !isNeutral && !good && "border-danger/40 bg-danger/10 text-text",
      )}
    >
      {delta > 0 ? "+" : ""}
      {formatMetric(delta)}
      {suffix ?? ""}
    </span>
  );
}

export function MetricRow({
  label,
  baseline,
  projected,
  delta,
  goodWhenPositive,
  suffix,
}: {
  label: string;
  baseline?: number;
  projected?: number;
  delta?: number;
  goodWhenPositive: boolean;
  suffix?: string;
}) {
  return (
    <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr_auto] items-center gap-2 rounded-lg border border-border bg-surface2/70 px-3 py-2 text-xs">
      <span className="font-medium text-text">{label}</span>
      <span className="text-right text-textMuted">{formatMetric(baseline)}</span>
      <span className="text-right text-textMuted">{formatMetric(projected)}</span>
      <DeltaChip delta={delta} goodWhenPositive={goodWhenPositive} suffix={suffix} />
    </div>
  );
}

export function TinyImpactBar({ value }: { value: number }) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  return <Progress value={safe} className="space-y-0" />;
}

export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      {subtitle ? <p className="text-xs text-textMuted">{subtitle}</p> : null}
    </div>
  );
}

export function StageHotspotsTable({ stages }: { stages: StageProjection[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Stage hotspots</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {stages.map((stage) => {
          const magnitude = Math.min(100, Math.abs(stage.delta.effectiveCapacityDelta) * 100);
          return (
            <div key={stage.stageId} className="space-y-1 rounded-lg border border-border bg-surface2/70 px-3 py-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-text">{stage.stageId}</span>
                <span className="text-textMuted">
                  eff Δ {formatMetric(stage.delta.effectiveCapacityDelta)} · wip Δ {formatMetric(stage.delta.wipPressureDelta)}
                </span>
              </div>
              <TinyImpactBar value={magnitude} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function EmptyStatePanel({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface2/60 px-4 py-6 text-center text-sm text-textMuted">
      {text}
    </div>
  );
}
