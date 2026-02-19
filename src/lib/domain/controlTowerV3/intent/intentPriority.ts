import type { CanonicalIntentParams } from "./intentCanonicalizer";

export function resolveEffectiveIntent(canonical: CanonicalIntentParams): CanonicalIntentParams {
  const effective: CanonicalIntentParams = {
    ...canonical,
    source: canonical.source,
  };

  const hasExplicitOverrides =
    typeof canonical.filter === "string" ||
    typeof canonical.stage === "string" ||
    typeof canonical.overdue === "boolean" ||
    typeof canonical.sinceDays === "number" ||
    (canonical.ids?.length ?? 0) > 0;

  if (hasExplicitOverrides) {
    return effective;
  }

  return effective;
}
