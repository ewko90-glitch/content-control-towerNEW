import type { CanonicalIntentParams } from "./intentCanonicalizer";

export type IntentDiagnostics = {
  applied: boolean;
  intent?: string;
  source?: string;
  resolvedMode?: string;
};

export function buildIntentDiagnostics(params: {
  applied: boolean;
  canonical: CanonicalIntentParams;
  resolvedMode?: string;
}): IntentDiagnostics {
  return {
    applied: params.applied,
    intent: params.canonical.intent,
    source: params.canonical.source,
    resolvedMode: params.resolvedMode,
  };
}
