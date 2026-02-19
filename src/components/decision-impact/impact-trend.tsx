"use client";

import { statusClasses, statusLabel } from "./impact-utils";
import type { ImpactEvaluation, ImpactWindow } from "./impact-types";

type ImpactTrendProps = {
  activeWindow: ImpactWindow;
  evaluations: Record<ImpactWindow, ImpactEvaluation>;
  onSelectWindow: (window: ImpactWindow) => void;
};

export function ImpactTrend(props: ImpactTrendProps) {
  const windows: ImpactWindow[] = [3, 7, 14];

  return (
    <div className="flex flex-wrap gap-2">
      {windows.map((window) => {
        const evaluation = props.evaluations[window];
        const active = props.activeWindow === window;

        return (
          <button
            key={window}
            type="button"
            onClick={() => props.onSelectWindow(window)}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${statusClasses(evaluation.status)} ${
              active ? "ring-2 ring-focusRing" : ""
            }`}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
            <span>{window}d</span>
            <span className="opacity-80">{statusLabel(evaluation.status)}</span>
            <span className="opacity-75">{Math.round(evaluation.confidence * 100)}%</span>
          </button>
        );
      })}
    </div>
  );
}
